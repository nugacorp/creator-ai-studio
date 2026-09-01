import type { FastifyError, FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { closeRedisRateLimiter, getRedisRateLimiter, type RedisLimiter } from './rate-limit-redis.js';

/**
 * Dependency-free HTTP hardening for the API:
 *  - security headers on every response
 *  - per-IP rate limiting (fixed window): Redis cuando REDIS_URL está definido,
 *    en memoria como fallback (single-node). Cumple D-5 del PROJECT_STATE.
 *  - global error handler that never leaks internals
 */

interface WindowEntry {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60_000;

/** Paths that trigger AI providers, ffmpeg or rclone — much stricter budget. */
const EXPENSIVE_PATTERNS = [
  /^\/(?:api\/)?(?:ai|gemini)\//,
  /^\/(?:api\/)?episodes\/[^/]+\/(?:render|shorts|thumbnail|pipeline|run-safe-pipeline|archive|restore|storyboard\/from-script|scenes\/generate-images)$/,
  /^\/(?:api\/)?system\/auto-archive$/,
  /^\/(?:api\/)?integrations\//,
  // Agent execution runs LLM calls directly (sync) or enqueues heavy work.
  /^\/(?:api\/)?episodes\/[^/]+\/agents\/[^/]+\/run$/,
];

const GENERAL_LIMIT = Number(process.env.RATE_LIMIT_GENERAL_PER_MIN ?? 600);
const EXPENSIVE_LIMIT = Number(process.env.RATE_LIMIT_EXPENSIVE_PER_MIN ?? 30);

function isExpensivePath(pathname: string): boolean {
  return EXPENSIVE_PATTERNS.some(re => re.test(pathname));
}

export function registerHardening(app: FastifyInstance): void {
  const general = new Map<string, WindowEntry>();
  const expensive = new Map<string, WindowEntry>();
  let redis: RedisLimiter | null = null;
  let redisResolved = false;

  // Periodic cleanup so the maps never grow unbounded. unref() keeps the
  // timer from holding the process open (important for tests).
  const cleanup = setInterval(() => {
    const cutoff = Date.now() - WINDOW_MS;
    for (const map of [general, expensive]) {
      for (const [key, entry] of map) {
        if (entry.windowStart < cutoff) map.delete(key);
      }
    }
  }, WINDOW_MS);
  cleanup.unref?.();
  app.addHook('onClose', async () => {
    clearInterval(cleanup);
    await closeRedisRateLimiter();
  });

  function consume(map: Map<string, WindowEntry>, key: string, limit: number): boolean {
    const now = Date.now();
    const entry = map.get(key);
    if (!entry || now - entry.windowStart >= WINDOW_MS) {
      map.set(key, { count: 1, windowStart: now });
      return true;
    }
    entry.count += 1;
    return entry.count <= limit;
  }

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    const pathname = request.url.split('?')[0] ?? '';
    const ip = request.ip ?? 'unknown';

    // Inicialización perezosa de Redis para no bloquear el arranque.
    if (!redisResolved) {
      redisResolved = true;
      redis = await getRedisRateLimiter();
    }

    let generalAllowed = true;
    let expensiveAllowed = true;

    if (redis) {
      try {
        generalAllowed = await redis.consume('general', ip, GENERAL_LIMIT, WINDOW_MS);
        if (isExpensivePath(pathname)) {
          expensiveAllowed = await redis.consume('expensive', ip, EXPENSIVE_LIMIT, WINDOW_MS);
        }
      } catch {
        // Si Redis se cae a mitad de vuelo, caemos al limitador en memoria.
        generalAllowed = consume(general, ip, GENERAL_LIMIT);
        if (isExpensivePath(pathname)) {
          expensiveAllowed = consume(expensive, ip, EXPENSIVE_LIMIT);
        }
      }
    } else {
      generalAllowed = consume(general, ip, GENERAL_LIMIT);
      if (isExpensivePath(pathname)) {
        expensiveAllowed = consume(expensive, ip, EXPENSIVE_LIMIT);
      }
    }

    if (!generalAllowed) {
      reply.header('retry-after', '60');
      return reply.code(429).send({ error: 'rate_limited', message: 'Too many requests' });
    }
    if (isExpensivePath(pathname) && !expensiveAllowed) {
      reply.header('retry-after', '60');
      return reply.code(429).send({
        error: 'rate_limited',
        message: 'Too many AI/media requests, retry in a minute',
      });
    }
  });

  app.addHook('onSend', async (_request, reply, payload) => {
    reply.header('x-content-type-options', 'nosniff');
    reply.header('x-frame-options', 'DENY');
    reply.header('referrer-policy', 'no-referrer');
    reply.header('cache-control', reply.getHeader('cache-control') ?? 'no-store');
    return payload;
  });

  app.setErrorHandler((error: FastifyError, request: FastifyRequest, reply: FastifyReply) => {
    // Fastify schema-validation errors are safe (and useful) to expose.
    if (error.validation) {
      return reply.code(400).send({
        error: 'validation_error',
        message: error.message,
      });
    }

    const statusCode = error.statusCode && error.statusCode >= 400 ? error.statusCode : 500;
    request.log.error({ err: error, url: request.url }, 'unhandled request error');

    if (statusCode >= 500) {
      // Never leak stack traces or provider internals to clients.
      return reply.code(statusCode).send({ error: 'internal_error' });
    }
    return reply.code(statusCode).send({ error: error.name, message: error.message });
  });
}
