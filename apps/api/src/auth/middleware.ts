import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import { timingSafeEqual } from 'node:crypto';
import process from 'node:process';
import { getAuthConfig } from './config.js';
import { verifySupabaseAccessToken } from './supabase-jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

const PUBLIC_PATHS = new Set([
  '/health',
  '/api/health',
  '/auth/status',
  '/api/auth/status',
  // Non-secret operational flags (demoMode, provider names) — used by DemoModeBanner and ops checks.
  '/system/mode',
  '/api/system/mode',
]);
const PUBLIC_PATH_PREFIXES = ['/oauth/', '/api/oauth/'];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) {
    return true;
  }
  return PUBLIC_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

/** Constant-time string comparison to avoid timing attacks on the API key. */
function safeEquals(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) {
    return false;
  }
  return timingSafeEqual(bufA, bufB);
}

export function registerAuthHook(app: FastifyInstance): void {
  const { apiKeyAuth, supabaseAuth } = getAuthConfig();
  const apiKeyValue = process.env.CAS_API_KEY;

  if (!apiKeyAuth && !supabaseAuth) {
    // Fail closed in production: never expose the API without authentication.
    if (process.env.NODE_ENV === 'production') {
      throw new Error(
        'Refusing to start without authentication in production. ' +
          'Set CAS_API_KEY and/or SUPABASE_URL (Supabase JWT auth) before deploying.',
      );
    }
    app.log?.warn?.(
      'API running WITHOUT authentication (no CAS_API_KEY / SUPABASE_URL). Dev mode only.',
    );
    return;
  }

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (isPublicPath(request.url.split('?')[0] ?? '')) {
      return;
    }

    const authHeader = request.headers.authorization;
    const headerKey = request.headers['x-api-key'];
    const bearerToken = authHeader?.startsWith('Bearer ') ? authHeader.slice(7) : undefined;
    const token =
      bearerToken ?? (typeof headerKey === 'string' ? headerKey : undefined);

    if (apiKeyAuth && apiKeyValue && token && safeEquals(token, apiKeyValue)) {
      return;
    }

    if (supabaseAuth && bearerToken) {
      const verified = await verifySupabaseAccessToken(bearerToken);
      if (verified) {
        request.userId = verified.userId;
        return;
      }
      if (!apiKeyAuth) {
        reply.code(401);
        return reply.send({ error: 'invalid_token' });
      }
    }

    if (apiKeyAuth || supabaseAuth) {
      reply.code(401);
      return reply.send({ error: 'unauthorized' });
    }
  });
}
