import Fastify, { type FastifyInstance } from 'fastify';
import type { EpisodeSummary } from '@creator-ai-studio/shared';

export interface BuildAppOptions {
  /** Enable Fastify's built-in logger. Defaults to false (quiet, test-friendly). */
  logger?: boolean;
}

/**
 * Build the Creator AI Studio API instance.
 *
 * Routes are intentionally minimal for the MVP skeleton: no external calls,
 * no persistence, no real content.
 */
export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });

  app.get('/health', async () => {
    return { status: 'ok', service: 'creator-ai-studio-api' };
  });

  app.get('/episodes', async (): Promise<EpisodeSummary[]> => {
    return [];
  });

  return app;
}
