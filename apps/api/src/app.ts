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
import { registerSecretRoutes } from './secrets/routes.js';
import { registerAIRoutes } from './ai/routes.js';
import { registerJobRoutes } from './jobs/routes.js';
import { fetchYouTubeAnalytics } from './integrations/youtube.js';
import { getSettings, saveSettings } from './settings/store.js';
import { createChannel, deleteChannel, listChannels, updateChannel } from './channels/store.js';
import { EpisodeStorage, resolveStoragePath } from './storage/index.js';
import { getSecret } from './secrets/resolver.js';
import { resolveProvider } from './ai/router.js';

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
    registerSecretRoutes(app, prefix);
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
    const detail = await storage.getEpisode(episode.id);
    if (detail) {
      const { syncEpisodeToSupabase } = await import('./db/episodes-sync.js');
      await syncEpisodeToSupabase(detail);
    }
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
    const { syncEpisodeToSupabase } = await import('./db/episodes-sync.js');
    await syncEpisodeToSupabase(detail);
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
    const { syncEpisodeToSupabase } = await import('./db/episodes-sync.js');
    await syncEpisodeToSupabase(detail);
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

    const updated = await storage.setStageStatus(id, stage, status);
    if (updated) {
      const { syncEpisodeToSupabase } = await import('./db/episodes-sync.js');
      await syncEpisodeToSupabase(updated);
    }
    return updated;
  });

  app.get(route(prefix, '/settings'), async () => getSettings());

  app.patch(route(prefix, '/settings'), async (request) => {
    const body = (request.body ?? {}) as Partial<import('@creator-ai-studio/shared').AppSettings>;
    return saveSettings(body);
  });

  app.get(route(prefix, '/channels'), async () => listChannels());

  app.post(route(prefix, '/channels'), async (request, reply) => {
    const body = (request.body ?? {}) as {
      name?: string;
      type?: string;
      status?: string;
      subscribers?: number;
      avatar?: string;
    };
    if (!body.name?.trim() || !body.type?.trim()) {
      reply.code(400);
      return { error: 'name and type are required' };
    }
    const channel = await createChannel({
      name: body.name,
      type: body.type,
      status: body.status,
      subscribers: body.subscribers,
      avatar: body.avatar,
    });
    reply.code(201);
    return channel;
  });

  app.patch(route(prefix, '/channels/:id'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as Record<string, unknown>;
    const updated = await updateChannel(id, body as Parameters<typeof updateChannel>[1]);
    if (!updated) {
      reply.code(404);
      return { error: 'channel not found' };
    }
    return updated;
  });

  app.delete(route(prefix, '/channels/:id'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const ok = await deleteChannel(id);
    if (!ok) {
      reply.code(404);
      return { error: 'channel not found' };
    }
    reply.code(204);
    return null;
  });

  app.get(route(prefix, '/system/mode'), async () => {
    const gemini = await getSecret('GEMINI_API_KEY');
    const openai = await getSecret('OPENAI_API_KEY');
    const anthropic = await getSecret('ANTHROPIC_API_KEY');
    const hasAiKey = Boolean(gemini || openai || anthropic);
    const provider = await resolveProvider();
    return {
      demoMode: !hasAiKey || provider.name === 'demo',
      aiProvider: provider.name,
    };
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
    const body = (request.body ?? {}) as { text?: string; voiceId?: string; episodeId?: string };
    const { synthesizeSpeech } = await import('./integrations/elevenlabs.js');
    let saveDir: string | undefined;
    if (body.episodeId) {
      const episode = await storage.getEpisode(body.episodeId);
      if (episode) {
        const path = await import('node:path');
        saveDir = path.join(resolveStoragePath(), episode.workspacePath, '05-audio');
      }
    }
    const result = await synthesizeSpeech(body.text ?? '', body.voiceId, { saveDir });
    if (body.episodeId && result.audioUrl && !result.isDemo) {
      const episode = await storage.getEpisode(body.episodeId);
      if (episode) {
        await storage.updateEpisode(body.episodeId, {
          content: { ...episode.content, audioUrl: result.audioUrl },
        });
      }
    }
    return result;
  });

  app.post(route(prefix, '/calendar/events'), async (request, reply) => {
    const body = (request.body ?? {}) as {
      episodeId?: string;
      title?: string;
      date?: string;
      status?: string;
    };
    if (body.episodeId) {
      const episode = await storage.updateEpisode(body.episodeId, {
        status: 'review',
        content: {
          scheduledAt: body.date ? `${body.date}T18:00:00Z` : undefined,
        },
      });
      if (!episode) {
        reply.code(404);
        return { error: 'episode not found' };
      }
      reply.code(201);
      return {
        id: episode.id,
        title: episode.title,
        date: body.date ?? episode.updatedAt.split('T')[0],
        status: 'scheduled',
      };
    }
    reply.code(400);
    return { error: 'episodeId is required' };
  });
}
