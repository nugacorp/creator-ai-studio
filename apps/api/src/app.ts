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
import { registerOAuthRoutes } from './oauth/routes.js';
import { registerAIRoutes } from './ai/routes.js';
import { registerJobRoutes } from './jobs/routes.js';
import { fetchYouTubeAnalytics } from './integrations/youtube.js';
import { getSettings, saveSettings } from './settings/store.js';
import { createChannel, deleteChannel, listChannels, updateChannel } from './channels/store.js';
import { EpisodeStorage, resolveStoragePath } from './storage/index.js';
import { getGeminiAuth } from './secrets/google-auth.js';
import { getSecret } from './secrets/resolver.js';
import { resolveProvider } from './ai/router.js';

export interface BuildAppOptions {
  logger?: boolean;
  storage?: EpisodeStorage;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? false,
    trustProxy: true,
  });
  const storage = options.storage ?? new EpisodeStorage(resolveStoragePath());

  registerAuthHook(app);

  const prefixes = ['', '/api'] as const;
  for (const prefix of prefixes) {
    registerRoutes(app, storage, prefix);
    registerAIRoutes(app, prefix);
    registerJobRoutes(app, prefix);
    registerSecretRoutes(app, prefix);
    registerOAuthRoutes(app, prefix);
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

    const settings = await getSettings();
    const activeCount = await storage.countActiveLocalEpisodes();
    if (activeCount >= settings.maxActiveEpisodes) {
      reply.code(409);
      return {
        error: `Máximo ${settings.maxActiveEpisodes} episodio(s) activo(s) en el VPS. Archiva o publica el actual antes de crear otro.`,
        activeCount,
        maxActiveEpisodes: settings.maxActiveEpisodes,
      };
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
    const geminiAuth = await getGeminiAuth();
    const openai = await getSecret('OPENAI_API_KEY');
    const anthropic = await getSecret('ANTHROPIC_API_KEY');
    const elevenlabs = await getSecret('ELEVENLABS_API_KEY');
    const hasAiKey = Boolean(geminiAuth || openai || anthropic);
    const provider = await resolveProvider();
    const settings = await getSettings();
    return {
      demoMode: !hasAiKey || provider.name === 'demo',
      aiProvider: provider.name,
      ttsProvider: settings.ttsProvider,
      ttsConfigured: Boolean(elevenlabs) || settings.ttsProvider === 'piper',
    };
  });

  app.get(route(prefix, '/system/storage'), async () => {
    const { getStorageStats } = await import('./system/storage.js');
    return getStorageStats(storage);
  });

  app.get(route(prefix, '/analytics'), async () => {
    const yt = await fetchYouTubeAnalytics('default');
    return {
      kpis: {
        views: yt.views,
        subscribers: yt.subscribers,
        watchTimeHours: yt.watchTimeHours,
        engagement: yt.engagement,
      },
      chartData: yt.chartData,
      channelDistribution: yt.channelDistribution,
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
    let videoPath = '';
    if (body.episodeId) {
      const dir = await storage.getEpisodeDirectory(body.episodeId);
      if (dir) {
        const pathMod = await import('node:path');
        const candidate = pathMod.join(dir, '06-video', 'episode.mp4');
        const { existsSync } = await import('node:fs');
        if (existsSync(candidate)) videoPath = candidate;
      }
    }
    const { uploadToYouTube } = await import('./integrations/youtube.js');
    const result = await uploadToYouTube(title, description, videoPath);
    if (body.episodeId && episode && result.videoId) {
      await storage.updateEpisode(body.episodeId, {
        status: 'published',
        content: { youtubeVideoId: result.videoId },
      });
    }
    return result;
  });

  app.get(route(prefix, '/integrations/elevenlabs/voices'), async () => {
    const { listElevenLabsVoices } = await import('./integrations/elevenlabs.js');
    return { voices: await listElevenLabsVoices() };
  });

  app.post(route(prefix, '/integrations/elevenlabs/tts'), async (request) => {
    const body = (request.body ?? {}) as { text?: string; voiceId?: string; episodeId?: string };
    const { synthesizeEpisodeSpeech } = await import('./integrations/tts.js');
    let saveDir: string | undefined;
    if (body.episodeId) {
      const episode = await storage.getEpisode(body.episodeId);
      if (episode) {
        const pathMod = await import('node:path');
        saveDir = pathMod.join(resolveStoragePath(), episode.workspacePath, '05-audio');
      }
    }
    const result = await synthesizeEpisodeSpeech({
      text: body.text ?? '',
      voiceId: body.voiceId,
      saveDir,
    });
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

  app.post(route(prefix, '/episodes/:id/render'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const episode = await storage.getEpisode(id);
    if (!episode) {
      reply.code(404);
      return { error: 'episode not found' };
    }
    const dir = await storage.getEpisodeDirectory(id);
    if (!dir) {
      reply.code(400);
      return { error: 'episodio archivado — restáuralo desde Drive para editar' };
    }
    const { renderEpisodeVideo } = await import('./media/render.js');
    const sceneUrls = episode.content.scenes.map(s => s.imageUrl).filter(Boolean);
    const result = await renderEpisodeVideo(dir, {
      sceneImageUrls: sceneUrls,
      thumbnailUrl: episode.content.thumbnailUrl,
    });
    if (result.ok) {
      await storage.updateEpisode(id, {
        content: { videoUrl: '/api/episodes/media/video' },
      });
    }
    return result;
  });

  app.post(route(prefix, '/episodes/:id/shorts'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const dir = await storage.getEpisodeDirectory(id);
    if (!dir) {
      reply.code(400);
      return { error: 'episodio no disponible en disco local' };
    }
    const { renderShortVideo } = await import('./media/render.js');
    const result = await renderShortVideo(dir);
    if (result.ok) {
      await storage.updateEpisode(id, {
        content: { shortsUrl: '/api/episodes/media/short' },
      });
    }
    return result;
  });

  app.post(route(prefix, '/episodes/:id/confirm-publish'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const episode = await storage.getEpisode(id);
    if (!episode) {
      reply.code(404);
      return { error: 'episode not found' };
    }
    const updated = await storage.updateEpisode(id, {
      content: { publishConfirmed: true },
      status: 'published',
    });
    const settings = await getSettings();
    if (settings.autoArchiveOnPublish) {
      const { createJob } = await import('./jobs/store.js');
      const { enqueueJob } = await import('./jobs/queue.js');
      const job = await createJob(id, { type: 'archive' });
      await enqueueJob(job);
    }
    return updated;
  });

  app.post(route(prefix, '/episodes/:id/archive'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const episode = await storage.getEpisode(id);
    if (!episode) {
      reply.code(404);
      return { error: 'episode not found' };
    }
    const dir = await storage.getEpisodeDirectory(id);
    if (!dir) {
      reply.code(400);
      return { error: 'ya archivado o no está en disco' };
    }
    const { archiveEpisodeWorkspace } = await import('./archive/drive.js');
    const result = await archiveEpisodeWorkspace(resolveStoragePath(), episode.workspacePath);
    if (result.ok && result.drivePath) {
      await storage.markArchived(episode, result.drivePath, episode.workspacePath);
    }
    return result;
  });

  app.post(route(prefix, '/episodes/:id/restore'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const episode = await storage.getEpisode(id);
    if (!episode || episode.archiveStatus !== 'archived') {
      reply.code(400);
      return { error: 'episodio no está archivado' };
    }
    const activeCount = await storage.countActiveLocalEpisodes();
    const settings = await getSettings();
    if (activeCount >= settings.maxActiveEpisodes) {
      reply.code(409);
      return { error: 'libera espacio archivando otro episodio activo primero' };
    }
    const workspace = episode.localWorkspace ?? `${episode.id}-${episode.slug}`;
    const { restoreEpisodeWorkspace } = await import('./archive/drive.js');
    const result = await restoreEpisodeWorkspace(resolveStoragePath(), workspace);
    if (result.ok) {
      await storage.removeFromArchivedIndex(id);
    }
    return result;
  });

  app.post(route(prefix, '/episodes/:id/thumbnail'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const episode = await storage.getEpisode(id);
    if (!episode) {
      reply.code(404);
      return { error: 'episode not found' };
    }
    const dir = await storage.getEpisodeDirectory(id);
    if (!dir) {
      reply.code(400);
      return { error: 'episodio no en disco local' };
    }
    const { withProvider } = await import('./ai/router.js');
    const imageUrl = await withProvider('image', p =>
      p.generateImage(`Miniatura YouTube: ${episode.title}`, { aspectRatio: '16:9' }),
    );
    const { saveThumbnailToDisk } = await import('./media/render.js');
    await saveThumbnailToDisk(dir, imageUrl);
    await storage.updateEpisode(id, {
      content: { thumbnailUrl: imageUrl },
    });
    return { imageUrl, saved: true };
  });

  app.post(route(prefix, '/episodes/:id/pipeline'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const episode = await storage.getEpisode(id);
    if (!episode) {
      reply.code(404);
      return { error: 'episode not found' };
    }
    const { createJob } = await import('./jobs/store.js');
    const { enqueueJob } = await import('./jobs/queue.js');
    const job = await createJob(id, { type: 'pipeline' });
    await enqueueJob(job);
    reply.code(201);
    return job;
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
