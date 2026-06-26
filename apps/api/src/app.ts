import Fastify, { type FastifyInstance } from 'fastify';
import {
  canTransitionStage,
  isEpisodeStage,
  isEpisodeStageStatus,
  type CreateEpisodeInput,
  type EpisodeSummary,
  type UpdateStageInput,
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

  const prefixes = ['', '/api'] as const;
  for (const prefix of prefixes) {
    registerRoutes(app, storage, prefix);
  }

  return app;
}

function route(prefix: string, path: string): string {
  return `${prefix}${path}`;
}

function registerRoutes(
  app: FastifyInstance,
  storage: EpisodeStorage,
  prefix: '' | '/api',
): void {
  app.get(route(prefix, '/health'), async () => {
    return { status: 'ok', service: 'creator-ai-studio-api' };
  });

  app.get(route(prefix, '/episodes'), async (): Promise<EpisodeSummary[]> => {
    return storage.listEpisodes();
  });

  app.get(route(prefix, '/episodes/:id'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const detail = await storage.getEpisode(id);

    if (detail === null) {
      reply.code(404);
      return { error: 'episode not found' };
    }

    return detail;
  });

  app.post(route(prefix, '/episodes'), async (request, reply) => {
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

  app.patch(route(prefix, '/episodes/:id/stages/:stage'), async (request, reply) => {
    const { id, stage } = request.params as { id: string; stage: string };
    const body = (request.body ?? {}) as Partial<UpdateStageInput>;
    const status = body.status;

    if (!isEpisodeStage(stage)) {
      reply.code(400);
      return { error: 'invalid stage' };
    }

    if (!isEpisodeStageStatus(status)) {
      reply.code(400);
      return { error: 'invalid status' };
    }

    const detail = await storage.getEpisode(id);
    if (detail === null) {
      reply.code(404);
      return { error: 'episode not found' };
    }

    const current = detail.stages.find((entry) => entry.stage === stage);
    if (current && !canTransitionStage(current.status, status)) {
      reply.code(400);
      return {
        error: `cannot transition stage from ${current.status} to ${status}`,
      };
    }

    return storage.setStageStatus(id, stage, status);
  });
}
