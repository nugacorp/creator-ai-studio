import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import process from 'node:process';

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
  const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;

  if (!apiKey && !supabaseJwtSecret) {
    return;
  }

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (isPublicPath(request.url.split('?')[0] ?? '')) {
      return;
    }

    const authHeader = request.headers.authorization;
    const headerKey = request.headers['x-api-key'];

    if (apiKey) {
      const token = authHeader?.startsWith('Bearer ')
        ? authHeader.slice(7)
        : typeof headerKey === 'string'
          ? headerKey
          : undefined;

      if (token !== apiKey) {
        reply.code(401);
        return reply.send({ error: 'unauthorized' });
      }
      return;
    }

    if (supabaseJwtSecret && authHeader?.startsWith('Bearer ')) {
      const token = authHeader.slice(7);
      try {
        const { jwtVerify } = await import('jose');
        await jwtVerify(token, new TextEncoder().encode(supabaseJwtSecret));
        return;
      } catch {
        reply.code(401);
        return reply.send({ error: 'invalid_token' });
      }
    }

    reply.code(401);
    return reply.send({ error: 'unauthorized' });
  });
}
