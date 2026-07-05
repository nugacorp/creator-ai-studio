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
import { getAuthConfig } from './auth/config.js';
import { registerHardening } from './http/hardening.js';
import {
  channelBody,
  channelPatchBody,
  createEpisodeBody,
  settingsBody,
  updateEpisodeBody,
  updateEpisodeStatusBody,
  updateStageBody,
} from './http/schemas.js';
import { registerSecretRoutes } from './secrets/routes.js';
import { registerOAuthRoutes } from './oauth/routes.js';
import { registerAIRoutes } from './ai/routes.js';
import { registerJobRoutes } from './jobs/routes.js';
import { registerAgentRoutes } from './agents/routes.js';
import { fetchYouTubeAnalytics } from './integrations/youtube.js';
import { getSettings, saveSettings } from './settings/store.js';
import { createChannel, deleteChannel, listChannels, updateChannel } from './channels/store.js';
import { EpisodeStorage, resolveStoragePath } from './storage/index.js';
import { getEpisodeForUser } from './storage/access.js';
import {
  getEpisodeMetadataSource,
  listEpisodesFromSupabase,
} from './db/episodes-metadata.js';
import { areMocksAllowed } from './config/mocks.js';
import { getGeminiAuth } from './secrets/google-auth.js';
import { getSecret } from './secrets/resolver.js';
import { resolveProviderName } from './ai/router.js';

export interface BuildAppOptions {
  logger?: boolean;
  storage?: EpisodeStorage;
}

export function buildApp(options: BuildAppOptions = {}): FastifyInstance {
  const app = Fastify({
    logger: options.logger ?? false,
    trustProxy: true,
  });

  // Medio 4 — tolerate an empty body on POST/PATCH "action" endpoints sent with
  // Content-Type: application/json. Without this, Fastify replies 400
  // (FST_ERR_CTP_EMPTY_JSON_BODY), which broke worker-driven pipeline steps
  // (thumbnail/render/shorts/publish-package/confirm/archive) that carry no body.
  app.addContentTypeParser(
    'application/json',
    { parseAs: 'string' },
    (_req, body, done) => {
      if (body === '' || body === undefined || body === null) {
        done(null, {});
        return;
      }
      try {
        done(null, JSON.parse(body as string));
      } catch (err) {
        (err as { statusCode?: number }).statusCode = 400;
        done(err as Error, undefined);
      }
    },
  );

  const storage = options.storage ?? new EpisodeStorage(resolveStoragePath());

  registerHardening(app);
  registerAuthHook(app);

  const prefixes = ['', '/api'] as const;
  for (const prefix of prefixes) {
    registerRoutes(app, storage, prefix);
    registerAIRoutes(app, prefix);
    registerJobRoutes(app, prefix);
    registerAgentRoutes(app, prefix, storage);
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
    const { checkFfmpeg } = await import('./media/render.js');
    const supabase = await checkSupabaseConnection();
    const ffmpegAvailable = await checkFfmpeg();
    return {
      status: 'ok',
      service: 'creator-ai-studio-api',
      supabase: supabase ?? 'not_configured',
      ffmpegAvailable,
      metadataSource: getEpisodeMetadataSource(),
      mocksAllowed: areMocksAllowed(),
    };
  });

  app.get(route(prefix, '/auth/status'), async () => getAuthConfig());

  app.get(route(prefix, '/episodes'), async (request): Promise<EpisodeSummary[]> => {
    const source = getEpisodeMetadataSource();
    if (source === 'supabase' || source === 'hybrid') {
      const fromDb = await listEpisodesFromSupabase(request.userId);
      if (fromDb && fromDb.length > 0) return fromDb;
      if (source === 'supabase') return fromDb ?? [];
    }
    return storage.listEpisodes(request.userId);
  });

  app.get(route(prefix, '/episodes/:id'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const detail = await getEpisodeForUser(storage, id, request.userId);
    if (detail === null) {
      reply.code(404);
      return { error: 'episode not found' };
    }
    return detail;
  });

  app.get(route(prefix, '/episodes/:id/assets'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const episode = await getEpisodeForUser(storage, id, request.userId);
    if (!episode) {
      reply.code(404);
      return { error: 'episode not found' };
    }
    const dir = await storage.getEpisodeDirectory(id);
    if (!dir) {
      return {
        episodeId: id,
        workspacePath: episode.workspacePath,
        storageLocation: 'remote',
        drivePath: episode.drivePath ?? null,
        message:
          'Este episodio está archivado. Restáuralo desde Drive o contacta al administrador del servidor.',
        files: [],
      };
    }
    const { listEpisodeAssets } = await import('./media/assets.js');
    const files = listEpisodeAssets(dir);
    const hasScript = episode.content.script.trim().length > 0;
    return {
      episodeId: id,
      workspacePath: episode.workspacePath,
      storageLocation: 'local',
      storageRoot: 'LOCAL_STORAGE_PATH en el servidor (p. ej. /data/episodes)',
      files: [
        ...files,
        {
          key: 'script',
          label: 'Guion (texto)',
          available: hasScript,
          filename: hasScript ? 'guion.txt' : undefined,
        },
      ],
    };
  });

  app.get(route(prefix, '/episodes/:id/files/:asset'), async (request, reply) => {
    const { id, asset } = request.params as { id: string; asset: string };
    const episode = await getEpisodeForUser(storage, id, request.userId);
    if (!episode) {
      reply.code(404);
      return { error: 'episode not found' };
    }
    const dir = await storage.getEpisodeDirectory(id);
    if (!dir) {
      reply.code(400);
      return { error: 'episodio archivado — no disponible en disco local' };
    }

    const { createReadStream } = await import('node:fs');
    const { resolveEpisodeAssetPath, buildScriptDownload } = await import('./media/assets.js');

    if (asset === 'script') {
      if (!episode.content.script.trim()) {
        reply.code(404);
        return { error: 'guion no disponible' };
      }
      const { body, filename } = await buildScriptDownload(dir, episode.title, episode.content.script);
      reply.header('Content-Disposition', `attachment; filename="${filename}"`);
      reply.type('text/plain; charset=utf-8');
      return body;
    }

    const allowed = new Set(['video', 'short', 'thumbnail', 'audio', 'content']);
    if (!allowed.has(asset)) {
      reply.code(400);
      return { error: 'invalid asset' };
    }

    const resolved = resolveEpisodeAssetPath(
      dir,
      asset as 'video' | 'short' | 'thumbnail' | 'audio' | 'content',
    );
    if (!resolved) {
      reply.code(404);
      return { error: 'archivo no encontrado' };
    }
    reply.header('Content-Disposition', `attachment; filename="${resolved.filename}"`);
    reply.type(resolved.contentType);
    return reply.send(createReadStream(resolved.path));
  });

  app.post(route(prefix, '/episodes'), { schema: { body: createEpisodeBody } }, async (request, reply) => {
    const body = (request.body ?? {}) as Partial<CreateEpisodeInput>;
    const title = typeof body.title === 'string' ? body.title.trim() : '';
    if (title.length === 0) {
      reply.code(400);
      return { error: 'title is required' };
    }

    const settings = await getSettings();
    const activeCount = await storage.countActiveLocalEpisodes(request.userId);
    if (activeCount >= settings.maxActiveEpisodes) {
      reply.code(409);
      return {
        error: `Máximo ${settings.maxActiveEpisodes} episodio(s) activo(s) en el VPS. Archiva o publica el actual antes de crear otro.`,
        activeCount,
        maxActiveEpisodes: settings.maxActiveEpisodes,
      };
    }

    const episode = await storage.createEpisode({ title }, request.userId);
    const detail = await storage.getEpisode(episode.id);
    if (detail) {
      const { syncEpisodeToSupabase } = await import('./db/episodes-sync.js');
      await syncEpisodeToSupabase(detail);
    }
    reply.code(201);
    return episode;
  });

  app.patch(route(prefix, '/episodes/:id'), { schema: { body: updateEpisodeBody } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as UpdateEpisodeInput;

    if (body.status !== undefined && !isEpisodeStatus(body.status)) {
      reply.code(400);
      return { error: 'invalid status' };
    }

    const existing = await getEpisodeForUser(storage, id, request.userId);
    if (existing === null) {
      reply.code(404);
      return { error: 'episode not found' };
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

  app.delete(route(prefix, '/episodes/:id'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const existing = await getEpisodeForUser(storage, id, request.userId);
    if (existing === null) {
      reply.code(404);
      return { error: 'episode not found' };
    }

    const deleted = await storage.deleteEpisode(id);
    if (!deleted) {
      reply.code(404);
      return { error: 'episode not found' };
    }

    const { deleteEpisodeFromSupabase } = await import('./db/episodes-sync.js');
    await deleteEpisodeFromSupabase(id);
    return { ok: true, id };
  });

  app.patch(route(prefix, '/episodes/:id/status'), { schema: { body: updateEpisodeStatusBody } }, async (request, reply) => {
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

  app.patch(route(prefix, '/episodes/:id/stages/:stage'), { schema: { body: updateStageBody } }, async (request, reply) => {
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

  app.patch(route(prefix, '/settings'), { schema: { body: settingsBody } }, async (request) => {
    const body = (request.body ?? {}) as Partial<import('@creator-ai-studio/shared').AppSettings>;
    return saveSettings(body);
  });

  app.get(route(prefix, '/channels'), async () => listChannels());

  app.post(route(prefix, '/channels'), { schema: { body: channelBody } }, async (request, reply) => {
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

  app.patch(route(prefix, '/channels/:id'), { schema: { body: channelPatchBody } }, async (request, reply) => {
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
    const aiProvider = await resolveProviderName('script');
    const settings = await getSettings();
    const { checkFfmpeg } = await import('./media/render.js');
    const ffmpegAvailable = await checkFfmpeg();
    const mocksAllowed = areMocksAllowed();
    const demoMode =
      mocksAllowed && (!hasAiKey || aiProvider === 'demo');
    return {
      demoMode,
      mocksAllowed,
      aiProvider,
      ttsProvider: settings.ttsProvider,
      ttsConfigured: Boolean(elevenlabs) || settings.ttsProvider === 'piper',
      ffmpegAvailable,
      metadataSource: getEpisodeMetadataSource(),
    };
  });

  app.get(route(prefix, '/system/storage'), async () => {
    const { getStorageStats } = await import('./system/storage.js');
    return getStorageStats(storage);
  });

  app.get(route(prefix, '/analytics'), async () => {
    const yt = await fetchYouTubeAnalytics('default');
    const hasData = yt.views > 0 || yt.chartData.length > 0;
    return {
      isDemo: yt.isDemo ?? false,
      connected: Boolean(yt.connected),
      hasData,
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

  app.get(route(prefix, '/calendar/events'), async (request) => {
    const episodes = await storage.listEpisodes(request.userId);
    return episodes
      .filter(e => e.status === 'review' || e.status === 'published')
      .map(e => ({
        id: e.id,
        title: e.title,
        date: e.updatedAt.split('T')[0],
        status: e.status === 'published' ? 'published' : 'scheduled',
      }));
  });

  app.post(route(prefix, '/integrations/youtube/upload'), async (request, reply) => {
    const body = (request.body ?? {}) as { episodeId?: string; authorize?: boolean };

    // FASE 3/6 safety gate: uploading to YouTube ALWAYS requires an explicit
    // human authorization flag. Pipelines in draft/review mode never set it.
    if (body.authorize !== true) {
      reply.code(403);
      return {
        error: 'publish_not_authorized',
        message:
          'La subida a YouTube requiere autorización explícita (authorize: true). ' +
          'Genera el publish package y confirma manualmente antes de publicar.',
      };
    }

    let episode = body.episodeId
      ? await getEpisodeForUser(storage, body.episodeId, request.userId)
      : null;
    if (body.episodeId && !episode) {
      reply.code(404);
      return { error: 'episode not found' };
    }
    const title = episode?.title ?? 'Untitled';
    const description = episode?.content?.seoDescription ?? episode?.title ?? '';
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
    try {
      const { uploadToYouTube } = await import('./integrations/youtube.js');
      const result = await uploadToYouTube(title, description, videoPath);
      if (body.episodeId && episode && result.videoId) {
        await storage.updateEpisode(body.episodeId, {
          status: 'review',
          content: { youtubeVideoId: result.videoId },
        });
      }
      return result;
    } catch (err) {
      reply.code(502);
      return {
        error: err instanceof Error ? err.message : 'YouTube upload failed',
      };
    }
  });

  app.get(route(prefix, '/integrations/elevenlabs/voices'), async () => {
    const { listElevenLabsVoices } = await import('./integrations/elevenlabs.js');
    return { voices: await listElevenLabsVoices() };
  });

  app.post(route(prefix, '/integrations/elevenlabs/tts'), async (request, reply) => {
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
    try {
      const result = await synthesizeEpisodeSpeech({
        text: body.text ?? '',
        voiceId: body.voiceId,
        saveDir,
      });
      // FASE 8: a "demo" TTS response means the provider is not configured.
      // When mocks are blocked (production), fail loudly instead of silently
      // returning empty/mock audio.
      if (result.isDemo) {
        const { areMocksAllowed } = await import('./config/mocks.js');
        if (!areMocksAllowed()) {
          reply.code(503);
          return {
            error: 'tts_not_configured',
            message:
              'TTS real no configurado (API key/voz faltante o proveedor sin saldo). ' +
              'Mocks bloqueados en este entorno.',
            provider: result.provider,
          };
        }
      }
      if (body.episodeId && (result.savedPath || (result.audioUrl && !result.isDemo))) {
        const episode = await storage.getEpisode(body.episodeId);
        if (episode) {
          await storage.updateEpisode(body.episodeId, {
            content: { ...episode.content, audioUrl: result.audioUrl },
          });
        }
      }
      return result;
    } catch (err) {
      reply.code(502);
      return {
        error: 'elevenlabs_tts_failed',
        message: err instanceof Error ? err.message : 'ElevenLabs TTS failed',
      };
    }
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

  app.post(route(prefix, '/episodes/:id/storyboard/from-script'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const episode = await storage.getEpisode(id);
    if (!episode) {
      reply.code(404);
      return { error: 'episode not found' };
    }
    const script = episode.content.script?.trim();
    if (!script) {
      reply.code(400);
      return { error: 'no_script', message: 'Escribe o genera un guion en la pestaña Guion primero.' };
    }
    const { parseScenesFromScript } = await import('./media/script-to-scenes.js');
    const scenes = parseScenesFromScript(script);
    if (scenes.length === 0) {
      reply.code(400);
      return {
        error: 'no_scenes_parsed',
        message: 'No se detectaron bloques de escena en el guion.',
      };
    }
    const updated = await storage.updateEpisode(id, { content: { scenes } });
    return { scenes, episode: updated };
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
    const episode = await getEpisodeForUser(storage, id, request.userId);
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
    const savedPath = await saveThumbnailToDisk(dir, imageUrl);
    if (!savedPath && !areMocksAllowed()) {
      reply.code(502);
      return {
        error: 'thumbnail_save_failed',
        message:
          'No se pudo guardar la miniatura en disco. Verifica el proveedor de imágenes y conectividad.',
      };
    }
    await storage.updateEpisode(id, {
      content: { thumbnailUrl: imageUrl },
    });
    return { imageUrl, saved: Boolean(savedPath) };
  });

  app.post(route(prefix, '/episodes/:id/pipeline'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const episode = await getEpisodeForUser(storage, id, request.userId);
    if (!episode) {
      reply.code(404);
      return { error: 'episode not found' };
    }
    const { createJob } = await import('./jobs/store.js');
    const { enqueueJob } = await import('./jobs/queue.js');
    // Legacy endpoint: now runs in draft mode (no YouTube). Use
    // /run-safe-pipeline explicitly, or the FASE 6 authorized-publish flow.
    const job = await createJob(id, {
      type: 'pipeline',
      payload: { mode: 'production-draft' },
    });
    await enqueueJob(job);
    reply.code(201);
    return job;
  });

  // FASE 3 — safe pipeline: every content stage, never touches YouTube.
  app.post(route(prefix, '/episodes/:id/run-safe-pipeline'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const episode = await getEpisodeForUser(storage, id, request.userId);
    if (!episode) {
      reply.code(404);
      return { error: 'episode not found' };
    }
    const body = (request.body ?? {}) as { mode?: string };
    const { isPipelineMode } = await import('@creator-ai-studio/shared');
    const mode = isPipelineMode(body.mode) ? body.mode : 'production-draft';
    if (mode === 'publish-authorized') {
      reply.code(403);
      return {
        error: 'publish_not_allowed_here',
        message:
          'run-safe-pipeline nunca publica. Usa el flujo de publicación autorizada (FASE 6).',
      };
    }
    const { createJob } = await import('./jobs/store.js');
    const { enqueueJob } = await import('./jobs/queue.js');
    const job = await createJob(id, { type: 'pipeline', payload: { mode } });
    await enqueueJob(job);
    reply.code(201);
    return job;
  });

  // FASE 3 — build the human-review publish package (no YouTube contact).
  app.post(route(prefix, '/episodes/:id/publish-package'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const episode = await getEpisodeForUser(storage, id, request.userId);
    if (!episode) {
      reply.code(404);
      return { error: 'episode not found' };
    }
    const dir = await storage.getEpisodeDirectory(id);
    if (!dir) {
      reply.code(400);
      return { error: 'episodio no disponible en disco local' };
    }
    const { buildPublishPackage } = await import('./publish/package.js');
    const result = await buildPublishPackage(episode, dir);
    return result;
  });

  // FASE 6 — authorized YouTube publish (requires explicit human confirmation).
  app.post(route(prefix, '/episodes/:id/authorize-publish'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { confirm?: boolean };
    if (body.confirm !== true) {
      reply.code(400);
      return {
        error: 'confirmation_required',
        message: 'Envía { "confirm": true } para autorizar la subida a YouTube.',
      };
    }
    const episode = await getEpisodeForUser(storage, id, request.userId);
    if (!episode) {
      reply.code(404);
      return { error: 'episode not found' };
    }
    const dir = await storage.getEpisodeDirectory(id);
    if (!dir) {
      reply.code(400);
      return { error: 'episodio no disponible en disco local' };
    }
    const { buildPublishPackage } = await import('./publish/package.js');
    const pkg = await buildPublishPackage(episode, dir);
    if (!pkg.ready) {
      reply.code(400);
      return {
        error: 'publish_package_not_ready',
        message: 'Completa todos los artefactos antes de publicar.',
        checklist: pkg.checklist,
      };
    }
    const { createJob } = await import('./jobs/store.js');
    const { enqueueJob } = await import('./jobs/queue.js');
    const job = await createJob(id, {
      type: 'pipeline',
      payload: { mode: 'publish-authorized', authorized: true },
    });
    await enqueueJob(job);
    reply.code(201);
    return { job, checklist: pkg.checklist };
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
