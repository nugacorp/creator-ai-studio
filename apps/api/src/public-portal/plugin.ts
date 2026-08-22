import type { FastifyInstance } from 'fastify';
import fastifyCors from '@fastify/cors';
import {
  fetchPublicEvents,
  fetchPublicLatestSermon,
  fetchPublicLive,
} from './views.js';
import { readCacheTtls, resolveAllowedOrigins } from './config.js';
import {
  publicEventsQuerySchema,
  publicEventsResponseSchema,
  publicLatestSermonResponseSchema,
  publicLiveResponseSchema,
} from './schemas.js';

/**
 * Public church portal — three read-only GET endpoints, no auth, cacheable.
 *
 * Registered only when `CHURCH_PUBLIC_SLUG` is set in the environment.
 * Mounted under `/api/public/*` once (not twice like the other routers) so
 * the surface is auditable. CORS is scoped to this plugin via encapsulation;
 * the rest of the API keeps its default no-CORS posture.
 */
export async function registerPublicPortal(app: FastifyInstance): Promise<void> {
  const slug = process.env.CHURCH_PUBLIC_SLUG?.trim();
  if (!slug) {
    app.log.info(
      { component: 'public-portal' },
      'CHURCH_PUBLIC_SLUG no está definido: el portal público no se registra.',
    );
    return;
  }

  const { origins, misconfigured } = resolveAllowedOrigins();
  if (misconfigured) {
    throw new Error(
      'Refusing to start the public portal without PUBLIC_CORS_ORIGINS in production. ' +
        'Set the list of allowed origins (comma-separated) before deploying.',
    );
  }

  const ttls = readCacheTtls();

  await app.register(async instance => {
    await instance.register(fastifyCors, {
      origin: origins,
      methods: ['GET', 'OPTIONS'],
      allowedHeaders: ['content-type'],
      credentials: false,
      maxAge: 86_400,
    });

    instance.get(
      '/live',
      { schema: { response: { 200: publicLiveResponseSchema } } },
      async (_request, reply) => {
        reply.header('cache-control', `public, max-age=${ttls.live}`);
        return fetchPublicLive();
      },
    );

    instance.get(
      '/events',
      {
        schema: {
          querystring: publicEventsQuerySchema,
          response: { 200: publicEventsResponseSchema },
        },
      },
      async (request, reply) => {
        reply.header('cache-control', `public, max-age=${ttls.content}`);
        const query = request.query as { limit?: number };
        const limit = typeof query.limit === 'number' ? query.limit : 3;
        return { items: await fetchPublicEvents(limit) };
      },
    );

    instance.get(
      '/latest-sermon',
      { schema: { response: { 200: publicLatestSermonResponseSchema } } },
      async (_request, reply) => {
        reply.header('cache-control', `public, max-age=${ttls.content}`);
        return { sermon: await fetchPublicLatestSermon() };
      },
    );
  });

  app.log.info(
    { component: 'public-portal', slug, origins, ttls },
    'Portal público registrado en /api/public/*',
  );
}
