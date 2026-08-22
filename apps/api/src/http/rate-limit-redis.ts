import process from 'node:process';

/**
 * Redis-backed rate limit counter.
 *
 * Used as the primary limiter in `http/hardening.ts` when REDIS_URL is set.
 * The implementation is the standard INCR + EXPIRE pattern: a counter key
 * lives 60 s, the request is allowed if the count stays under the limit.
 *
 * Survives restarts and scales horizontally: each API instance shares the
 * same Redis instance, so the per-IP budget is global instead of per-pod.
 */

interface RedisLimiter {
  /** Returns true if the request fits under the per-minute limit. */
  consume(scope: string, key: string, limit: number, windowMs: number): Promise<boolean>;
  close(): Promise<void>;
}

class IoredisLimiter implements RedisLimiter {
  private readonly client: import('ioredis').Redis;
  private constructor(client: import('ioredis').Redis) {
    this.client = client;
  }

  static async create(url: string): Promise<IoredisLimiter> {
    const mod = await import('ioredis');
    const Redis = (mod.Redis ?? mod.default) as unknown as new (
      url: string,
      options?: Record<string, unknown>,
    ) => import('ioredis').Redis;
    const client = new Redis(url, { lazyConnect: false, maxRetriesPerRequest: 2 });
    return new IoredisLimiter(client);
  }

  async consume(scope: string, key: string, limit: number, windowMs: number): Promise<boolean> {
    const bucket = `${scope}:${key}:${Math.floor(Date.now() / windowMs)}`;
    const count = await this.client.incr(bucket);
    if (count === 1) {
      await this.client.expire(bucket, Math.ceil(windowMs / 1000));
    }
    return count <= limit;
  }

  async close(): Promise<void> {
    try {
      await this.client.quit();
    } catch {
      // ignore close errors during shutdown
    }
  }
}

let limiter: RedisLimiter | null = null;
let limiterPromise: Promise<RedisLimiter | null> | null = null;

export function getRedisRateLimiter(): Promise<RedisLimiter | null> {
  if (limiter) return Promise.resolve(limiter);
  if (limiterPromise) return limiterPromise;
  const url = process.env.REDIS_URL;
  if (!url) return Promise.resolve(null);
  limiterPromise = (async () => {
    try {
      limiter = await IoredisLimiter.create(url);
      return limiter;
    } catch {
      // Redis no disponible → caemos al limitador en memoria.
      return null;
    } finally {
      limiterPromise = null;
    }
  })();
  return limiterPromise;
}

export async function closeRedisRateLimiter(): Promise<void> {
  if (!limiter) return;
  await limiter.close();
  limiter = null;
}

export type { RedisLimiter };
