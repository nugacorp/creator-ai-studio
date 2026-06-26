import Fastify, { type FastifyInstance } from 'fastify';
import type {
  CreateEpisodeInput,
  EpisodeSummary,
} from '@creator-ai-studio/shared';
import { EpisodeStorage, resolveStoragePath } from './storage/index.js';

export interface BuildAppOptions {
  /** Enable Fastify's built-in logger. Defaults to false (quiet, test-friendly). */
  logger?: boolean;
  /** Storage backend. Defaults to local filesystem storage. */
  storage?: EpisodeStorage;
}

/**
 * Build the Creator AI Studio API instance.
 *
 * The first functional flow: create an episode locally, persist it to the
 * filesystem, and list it. No external services are called.
 */
export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });
  const storage = options.storage ?? new EpisodeStorage(resolveStoragePath());

  app.get('/health', async () => {
    return { status: 'ok', service: 'creator-ai-studio-api' };
  });

  app.get('/episodes', async (): Promise<EpisodeSummary[]> => {
    return storage.listEpisodes();
  });

  app.get('/episodes/:id', async (request, reply) => {
    const { id } = request.params as { id: string };
    const detail = await storage.getEpisode(id);

    if (detail === null) {
      reply.code(404);
      return { error: 'episode not found' };
    }

    return detail;
  });

  app.post('/episodes', async (request, reply) => {
    const body = (request.body ?? {}) as Partial<CreateEpisodeInput>;
    const title = typeof body.title === 'string' ? body.title.trim() : '';

    if (title.length === 0) {
      reply.code(400);
      return { error: 'title is required' };
    }

    const episode = await storage.createEpisode({ title });
    reply.code(201);
    return episode;
  });

  return app;
}
