import Fastify, { type FastifyInstance } from 'fastify';
import {
  canTransitionStage,
  isEpisodeStage,
  isEpisodeStageStatus,
  isEpisodeStatus,
  isProjectStatus,
  PROJECT_TO_EPISODE_STATUS,
  type CreateEpisodeInput,
  type EpisodeSummary,
  type UpdateEpisodeInput,
  type UpdateStageInput,
} from '@creator-ai-studio/shared';
import { registerAuthHook } from './auth/middleware.js';
import { registerAIRoutes } from './ai/routes.js';
import { registerJobRoutes } from './jobs/routes.js';
import { fetchYouTubeAnalytics } from './integrations/youtube.js';
import { getSettings, saveSettings } from './settings/store.js';
import { EpisodeStorage, resolveStoragePath } from './storage/index.js';

export interface BuildAppOptions {
  logger?: boolean;
  storage?: EpisodeStorage;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({ logger: options.logger ?? false });
  const storage = options.storage ?? new EpisodeStorage(resolveStoragePath());

  registerAuthHook(app);

  const prefixes = ['', '/api'] as const;
  for (const prefix of prefixes) {
    registerRoutes(app, storage, prefix);
    registerAIRoutes(app, prefix);
    registerJobRoutes(app, prefix);
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
    const { checkSupabaseConnection } = await import('./db/supabase.js');
    const supabase = await checkSupabaseConnection();
    return {
      status: 'ok',
      service: 'creator-ai-studio-api',
      supabase: supabase ?? 'not_configured',
    };
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

  app.patch(route(prefix, '/episodes/:id'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as UpdateEpisodeInput;

    if (body.status !== undefined && !isEpisodeStatus(body.status)) {
      reply.code(400);
      return { error: 'invalid status' };
    }

    const detail = await storage.updateEpisode(id, body);
    if (detail === null) {
      reply.code(404);
      return { error: 'episode not found' };
    }
    return detail;
  });

  app.patch(route(prefix, '/episodes/:id/status'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { projectStatus?: string };

    if (!isProjectStatus(body.projectStatus)) {
      reply.code(400);
      return { error: 'invalid project status' };
    }

    const episodeStatus = PROJECT_TO_EPISODE_STATUS[body.projectStatus];
    const detail = await storage.updateEpisode(id, { status: episodeStatus });
    if (detail === null) {
      reply.code(404);
      return { error: 'episode not found' };
    }
    return detail;
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

  app.get(route(prefix, '/settings'), async () => getSettings());

  app.patch(route(prefix, '/settings'), async (request) => {
    const body = (request.body ?? {}) as Partial<import('@creator-ai-studio/shared').AppSettings>;
    return saveSettings(body);
  });

  app.get(route(prefix, '/channels'), async () => {
    return [
      { id: 'ch1', name: 'Canal Cristiano', type: 'YouTube', status: 'Produciendo', subscribers: 125000, avatar: '⛪' },
      { id: 'ch2', name: 'Canal Finanzas', type: 'YouTube', status: 'Publicado', subscribers: 84000, avatar: '💰' },
      { id: 'ch3', name: 'Canal IA', type: 'TikTok', status: 'En edición', subscribers: 45000, avatar: '🤖' },
      { id: 'ch4', name: 'Canal Podcast', type: 'Podcast', status: 'Investigación', subscribers: 18000, avatar: '🎙️' },
    ];
  });

  app.get(route(prefix, '/analytics'), async () => {
    const yt = await fetchYouTubeAnalytics('default');
    return {
      kpis: {
        views: yt.views,
        subscribers: yt.subscribers,
        watchTimeHours: yt.watchTimeHours,
        engagement: '4.2%',
      },
      chartData: [120, 180, 150, 220, 280, 310, 290],
    };
  });

  app.get(route(prefix, '/calendar/events'), async () => {
    const episodes = await storage.listEpisodes();
    return episodes
      .filter(e => e.status === 'review' || e.status === 'published')
      .map(e => ({
        id: e.id,
        title: e.title,
        date: e.updatedAt.split('T')[0],
        status: e.status === 'published' ? 'published' : 'scheduled',
      }));
  });

  app.post(route(prefix, '/integrations/youtube/upload'), async (request) => {
    const body = (request.body ?? {}) as { episodeId?: string };
    const episode = body.episodeId ? await storage.getEpisode(body.episodeId) : null;
    const title = episode?.title ?? 'Untitled';
    const description = episode?.content?.seoDescription ?? '';
    const { uploadToYouTube } = await import('./integrations/youtube.js');
    return uploadToYouTube(title, description, '');
  });

  app.post(route(prefix, '/integrations/elevenlabs/tts'), async (request) => {
    const body = (request.body ?? {}) as { text?: string; voiceId?: string };
    const { synthesizeSpeech } = await import('./integrations/elevenlabs.js');
    return synthesizeSpeech(body.text ?? '', body.voiceId);
  });
}
