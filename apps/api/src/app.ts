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
import { registerIdeaRoutes } from './ideas/routes.js';
import { registerTeamRoutes } from './team/routes.js';
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
    registerIdeaRoutes(app, prefix, storage);
    registerTeamRoutes(app, prefix);
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
    const { normalizeEpisodeContentUrls } = await import('./media/media-urls.js');
    return normalizeEpisodeContentUrls(detail);
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
    const { listEpisodeAssets, listEpisodeSceneImages } = await import('./media/assets.js');
    const files = listEpisodeAssets(dir);
    const sceneImages = listEpisodeSceneImages(id, dir, episode.content.scenes ?? []);
    const hasScript = episode.content.script.trim().length > 0;
    return {
      episodeId: id,
      workspacePath: episode.workspacePath,
      storageLocation: 'local',
      storageRoot: 'LOCAL_STORAGE_PATH en el servidor (p. ej. /data/episodes)',
      sceneImages,
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

    const allowed = new Set(['video', 'short', 'thumbnail', 'audio', 'music', 'content']);
    if (!allowed.has(asset)) {
      reply.code(400);
      return { error: 'invalid asset' };
    }

    const resolved = resolveEpisodeAssetPath(
      dir,
      asset as 'video' | 'short' | 'thumbnail' | 'audio' | 'music' | 'content',
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

    if (body.content) {
      const { stagesToInvalidate } = await import('./media/production-locks.js');
      const mergedContent = { ...existing.content, ...body.content };
      const toReset = stagesToInvalidate(existing.content, mergedContent);
      for (const stage of toReset) {
        await storage.setStageStatus(id, stage, 'pending');
      }
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
    const detail = await storage.updateEpisode(id, {
      status: episodeStatus,
      content: { kanbanColumn: body.projectStatus },
    });
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
    const { buildCalendarEvents } = await import('./calendar/events.js');
    const result = await buildCalendarEvents(storage, request.userId);
    return result.events;
  });

  app.get(route(prefix, '/integrations/youtube/channels'), async () => {
    const { fetchYouTubeChannels } = await import('./integrations/youtube.js');
    return fetchYouTubeChannels();
  });

  app.post(route(prefix, '/integrations/youtube/upload'), async (request, reply) => {
    const body = (request.body ?? {}) as {
      episodeId?: string;
      authorize?: boolean;
      publishAt?: string;
    };

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
    const title = episode?.content?.seoTitles?.[0] ?? episode?.title ?? 'Untitled';
    const { buildYouTubeDescription } = await import('./seo/description.js');
    const description = buildYouTubeDescription(
      episode?.content?.seoDescription ?? episode?.title ?? '',
      episode?.content?.seoChapters,
    );
    let videoPath = '';
    let thumbnailPath = '';
    if (body.episodeId) {
      const dir = await storage.getEpisodeDirectory(body.episodeId);
      if (dir) {
        const pathMod = await import('node:path');
        const candidate = pathMod.join(dir, '06-video', 'episode.mp4');
        const thumb = pathMod.join(dir, '07-thumbnail', 'thumbnail.png');
        const { existsSync } = await import('node:fs');
        if (existsSync(candidate)) videoPath = candidate;
        if (existsSync(thumb)) thumbnailPath = thumb;
      }
    }
    try {
      const { uploadToYouTube, uploadYouTubeThumbnail } = await import('./integrations/youtube.js');
      const result = await uploadToYouTube(title, description, videoPath, {
        publishAt: body.publishAt,
      });
      if (thumbnailPath && result.videoId && !result.videoId.startsWith('yt_')) {
        try {
          await uploadYouTubeThumbnail(result.videoId, thumbnailPath);
        } catch (thumbErr) {
          request.log.warn(
            { err: thumbErr },
            'Video subido pero miniatura no — sube manualmente o revisa scopes OAuth',
          );
        }
      }
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
    const body = (request.body ?? {}) as { text?: string; voiceId?: string; episodeId?: string; force?: boolean };
    const { synthesizeEpisodeSpeech } = await import('./integrations/tts.js');
    let saveDir: string | undefined;
    if (body.episodeId) {
      const episode = await storage.getEpisode(body.episodeId);
      if (episode) {
        const pathMod = await import('node:path');
        saveDir = pathMod.join(resolveStoragePath(), episode.workspacePath, '05-audio');
        const { isStageCompleted, hasAudioFile } = await import('./media/production-locks.js');
        const episodeDir = await storage.getEpisodeDirectory(body.episodeId);
        if (
          !body.force &&
          episodeDir &&
          isStageCompleted(episode, 'audio') &&
          hasAudioFile(episodeDir) &&
          episode.content.audioUrl
        ) {
          const { episodeFileUrl } = await import('./media/media-urls.js');
          return {
            audioUrl: episodeFileUrl(body.episodeId, 'audio'),
            skipped: true,
            provider: 'elevenlabs',
            isDemo: false,
          };
        }
      }
    }
    try {
      const result = await synthesizeEpisodeSpeech({
        text: body.text ?? '',
        voiceId: body.voiceId,
        saveDir,
        episodeId: body.episodeId,
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
        const { episodeFileUrl } = await import('./media/media-urls.js');
        const audioUrl = episodeFileUrl(body.episodeId, 'audio');
        const episode = await storage.getEpisode(body.episodeId);
        if (episode) {
          await storage.updateEpisode(body.episodeId, {
            content: { ...episode.content, audioUrl },
          });
        }
        return { ...result, audioUrl };
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
    const body = (request.body ?? {}) as { force?: boolean };
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
    const { isStageCompleted, hasVideoFile } = await import('./media/production-locks.js');
    if (!body.force && isStageCompleted(episode, 'video') && hasVideoFile(dir) && episode.content.videoUrl) {
      const { episodeFileUrl, normalizeEpisodeContentUrls } = await import('./media/media-urls.js');
      const normalized = normalizeEpisodeContentUrls(episode).content.videoUrl;
      return { ok: true, skipped: true, videoUrl: normalized ?? episodeFileUrl(id, 'video') };
    }
    const { renderEpisodeVideo } = await import('./media/render.js');
    const result = await renderEpisodeVideo(dir, {
      scenes: episode.content.scenes,
      sceneImageUrls: episode.content.scenes.map(s => s.imageUrl).filter(Boolean),
      thumbnailUrl: episode.content.thumbnailUrl,
    });
    if (result.ok) {
      const { episodeFileUrl } = await import('./media/media-urls.js');
      const videoUrl = episodeFileUrl(id, 'video');
      await storage.updateEpisode(id, {
        content: { videoUrl },
      });
      return { ...result, videoUrl };
    }
    return result;
  });

  app.post(route(prefix, '/episodes/:id/subtitles/generate'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { force?: boolean };
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
    const { isStageCompleted, hasSubtitlesFile } = await import('./media/production-locks.js');
    if (
      !body.force &&
      isStageCompleted(episode, 'subtitles') &&
      hasSubtitlesFile(dir) &&
      episode.content.subtitlesSrt?.trim()
    ) {
      return { ok: true, skipped: true, subtitlesSrt: episode.content.subtitlesSrt };
    }
    const script = episode.content.script?.trim();
    if (!script && episode.content.scenes.length === 0) {
      reply.code(400);
      return {
        error: 'no_source',
        message: 'Necesitas un guion o escenas para generar subtítulos.',
      };
    }
    const { generateSubtitlesSrt, writeSubtitlesFile } = await import('./media/subtitles.js');
    const srt = generateSubtitlesSrt(episode.content);
    if (!srt.trim()) {
      reply.code(400);
      return { error: 'empty_subtitles', message: 'No se pudo derivar texto para subtítulos.' };
    }
    await writeSubtitlesFile(dir, srt);
    const updated = await storage.updateEpisode(id, {
      content: { subtitlesSrt: srt },
    });
    return { ok: true, subtitlesSrt: srt, episode: updated };
  });

  app.post(route(prefix, '/episodes/:id/storyboard/from-script'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { force?: boolean };
    const episode = await storage.getEpisode(id);
    if (!episode) {
      reply.code(404);
      return { error: 'episode not found' };
    }
    const { isStageCompleted } = await import('./media/production-locks.js');
    if (
      !body.force &&
      isStageCompleted(episode, 'storyboard') &&
      episode.content.scenes.length > 0
    ) {
      return { scenes: episode.content.scenes, episode, skipped: true };
    }
    const script = episode.content.script?.trim();
    if (!script) {
      reply.code(400);
      return { error: 'no_script', message: 'Escribe o genera un guion en la pestaña Guion primero.' };
    }
    const dir = await storage.getEpisodeDirectory(id);
    const { parseScenesFromScript } = await import('./media/script-to-scenes.js');
    const { mergeScenesWithExisting } = await import('./media/merge-scenes.js');
    const parsed = parseScenesFromScript(script, episode.title);
    if (parsed.length === 0) {
      reply.code(400);
      return {
        error: 'no_scenes_parsed',
        message: 'No se detectaron bloques de escena en el guion.',
      };
    }
    const scenes = mergeScenesWithExisting(parsed, episode.content.scenes, dir ?? undefined);
    const updated = await storage.updateEpisode(id, { content: { scenes } });
    return { scenes, episode: updated };
  });

  app.post(route(prefix, '/episodes/:id/scenes/generate-images'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { sceneIds?: string[]; force?: boolean; skipLlmRefine?: boolean };
    const episode = await storage.getEpisode(id);
    if (!episode) {
      reply.code(404);
      return { error: 'episode not found' };
    }
    const dir = await storage.getEpisodeDirectory(id);
    if (!dir) {
      reply.code(400);
      return { error: 'episodio archivado — restáuralo para generar imágenes' };
    }
    const { generateSceneImagesForEpisode } = await import('./media/scene-images.js');
    const { isStageCompleted, allScenesHaveStoredImages } = await import('./media/production-locks.js');
    if (
      !body.force &&
      isStageCompleted(episode, 'assets') &&
      allScenesHaveStoredImages(dir, episode.content.scenes)
    ) {
      return {
        scenes: episode.content.scenes,
        generated: 0,
        skipped: true,
        episode,
      };
    }
    const result = await generateSceneImagesForEpisode(
      id,
      dir,
      episode.content.scenes,
      episode.title,
      { sceneIds: body.sceneIds, force: body.force, skipLlmRefine: body.skipLlmRefine },
    );
    const updated = await storage.updateEpisode(id, { content: { scenes: result.scenes } });
    return { scenes: result.scenes, generated: result.generated, episode: updated };
  });

  app.get(route(prefix, '/episodes/:id/scene-images/:filename'), async (request, reply) => {
    const { id, filename } = request.params as { id: string; filename: string };
    if (!/^slide-\d{3}\.png$/.test(filename)) {
      reply.code(400);
      return { error: 'invalid filename' };
    }
    const { existsSync, createReadStream } = await import('node:fs');
    const pathMod = await import('node:path');
    const dir = await storage.getEpisodeDirectory(id);
    if (!dir) {
      reply.code(404);
      return { error: 'not found' };
    }
    const filePath = pathMod.join(dir, '04-assets', filename);
    if (!existsSync(filePath)) {
      reply.code(404);
      return { error: 'not found' };
    }
    reply.type('image/png');
    return reply.send(createReadStream(filePath));
  });

  app.post(route(prefix, '/episodes/:id/shorts'), async (request, reply) => {
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
    const { renderShortVideo } = await import('./media/render.js');
    const moments = (episode.content.shorts ?? []).map(s => ({
      id: s.id,
      startTime: s.startTime,
    }));
    const result = await renderShortVideo(dir, moments.length > 0 ? moments : undefined);
    if (result.ok && result.rendered) {
      const updatedShorts = (episode.content.shorts ?? []).map((s, i) => ({
        ...s,
        videoPath: result.rendered?.[i]
          ? `09-shorts/${result.rendered[i]!.filename}`
          : s.videoPath,
      }));
      if (updatedShorts.length === 0 && result.rendered.length > 0) {
        for (const r of result.rendered) {
          updatedShorts.push({
            id: r.id,
            title: episode.title,
            description: '',
            scriptText: '',
            videoPath: `09-shorts/${r.filename}`,
          });
        }
      }
      await storage.updateEpisode(id, {
        content: {
          shorts: updatedShorts,
          shortsUrl: '/api/episodes/media/short',
        },
      });
      await storage.setStageStatus(id, 'shorts', 'completed');
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

  app.post(route(prefix, '/episodes/:id/music/generate'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      prompt?: string;
      model?: 'lyria-3-clip-preview' | 'lyria-3-pro-preview';
      force?: boolean;
      assignToScenes?: boolean;
    };
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
    const { episodeFileUrl } = await import('./media/media-urls.js');
    const canonicalUrl = episodeFileUrl(id, 'music');
    const { hasBackgroundMusicFile } = await import('./media/production-locks.js');
    const { readMusicMeta, generateEpisodeMusic, applyMusicLabelToScenes, arePromptsSimilar } =
      await import('./media/music.js');

    if (
      !body.force &&
      hasBackgroundMusicFile(dir) &&
      episode.content.musicUrl &&
      body.prompt?.trim()
    ) {
      const meta = await readMusicMeta(dir);
      if (meta && arePromptsSimilar(body.prompt, meta.prompt)) {
        return {
          musicUrl: canonicalUrl,
          saved: true,
          skipped: true,
          label: meta.label ?? body.prompt.slice(0, 72),
        };
      }
    }

    try {
      const result = await generateEpisodeMusic(id, dir, {
        prompt: body.prompt,
        model: body.model,
        force: body.force,
        title: episode.title,
        script: episode.content.script,
      });
      const scenes =
        body.assignToScenes !== false
          ? applyMusicLabelToScenes(episode.content.scenes, result.label)
          : episode.content.scenes;
      await storage.updateEpisode(id, {
        content: {
          musicUrl: result.musicUrl,
          ...(body.assignToScenes !== false ? { scenes } : {}),
        },
      });
      return {
        musicUrl: result.musicUrl,
        saved: result.saved,
        skipped: result.skipped,
        label: result.label,
        model: result.meta.model,
      };
    } catch (err) {
      const message = err instanceof Error ? err.message : 'music generation failed';
      if (message.includes('LYRIA_NOT_CONFIGURED')) {
        reply.code(503);
        return {
          error: 'lyria_not_configured',
          message:
            'Configura GEMINI_API_KEY o conecta Google OAuth (Gemini) en Ajustes para usar Lyria.',
        };
      }
      reply.code(502);
      return { error: 'music_generation_failed', message };
    }
  });

  app.post(route(prefix, '/episodes/:id/thumbnail'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { force?: boolean; prompt?: string };
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
    const { episodeFileUrl } = await import('./media/media-urls.js');
    const canonicalUrl = episodeFileUrl(id, 'thumbnail');
    const { isStageCompleted, hasThumbnailFile } = await import('./media/production-locks.js');
    if (
      !body.force &&
      isStageCompleted(episode, 'thumbnail') &&
      hasThumbnailFile(dir) &&
      episode.content.thumbnailUrl
    ) {
      return { imageUrl: canonicalUrl, saved: true, skipped: true };
    }
    const { withProvider } = await import('./ai/router.js');
    const prompt =
      body.prompt?.trim() ||
      `Miniatura YouTube cinematográfica 16:9 para video cristiano: ${episode.title}`;
    const imageUrl = await withProvider('image', p =>
      p.generateImage(prompt, { aspectRatio: '16:9', style: 'cinematic biblical' }),
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
      content: { thumbnailUrl: canonicalUrl },
    });
    return { imageUrl: canonicalUrl, saved: Boolean(savedPath) };
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
    const body = (request.body ?? {}) as { confirm?: boolean; scheduledAt?: string };
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
    if (body.scheduledAt) {
      await storage.updateEpisode(id, {
        content: { scheduledAt: body.scheduledAt },
      });
    }
    const { createJob } = await import('./jobs/store.js');
    const { enqueueJob } = await import('./jobs/queue.js');
    const job = await createJob(id, {
      type: 'pipeline',
      payload: {
        mode: 'publish-authorized',
        authorized: true,
        scheduledAt: body.scheduledAt,
      },
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
