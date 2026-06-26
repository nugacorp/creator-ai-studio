import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import process from 'node:process';

const PUBLIC_PATHS = new Set([
  '/health',
  '/api/health',
]);

export function registerAuthHook(app: FastifyInstance): void {
  const apiKey = process.env.CAS_API_KEY;
  const supabaseJwtSecret = process.env.SUPABASE_JWT_SECRET;

  if (!apiKey && !supabaseJwtSecret) {
    return;
  }

  app.addHook('onRequest', async (request: FastifyRequest, reply: FastifyReply) => {
    if (PUBLIC_PATHS.has(request.url.split('?')[0] ?? '')) {
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
      // JWT validation placeholder — production should verify signature with jose/jsonwebtoken
      return;
    }

    reply.code(401);
    return reply.send({ error: 'unauthorized' });
  });
}
