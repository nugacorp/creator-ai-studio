import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import process from 'node:process';
import { isSupabaseAuthConfigured, verifySupabaseAccessToken } from './supabase-jwt.js';

declare module 'fastify' {
  interface FastifyRequest {
    userId?: string;
  }
}

const PUBLIC_PATHS = new Set(['/health', '/api/health']);
const PUBLIC_PATH_PREFIXES = ['/oauth/', '/api/oauth/'];

function isPublicPath(pathname: string): boolean {
  if (PUBLIC_PATHS.has(pathname)) {
    return true;
  }
  return PUBLIC_PATH_PREFIXES.some(prefix => pathname.startsWith(prefix));
}

export function registerAuthHook(app: FastifyInstance): void {
  const apiKey = process.env.CAS_API_KEY;
  const supabaseAuth = isSupabaseAuthConfigured();

  if (!apiKey && !supabaseAuth) {
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

    if (apiKey && token === apiKey) {
      return;
    }

    if (supabaseAuth && bearerToken) {
      const verified = await verifySupabaseAccessToken(bearerToken);
      if (verified) {
        request.userId = verified.userId;
        return;
      }
      if (!apiKey) {
        reply.code(401);
        return reply.send({ error: 'invalid_token' });
      }
    }

    if (apiKey || supabaseAuth) {
      reply.code(401);
      return reply.send({ error: 'unauthorized' });
    }
  });
}
