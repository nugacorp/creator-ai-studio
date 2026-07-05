import { existsSync, readdirSync } from 'node:fs';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type { EpisodeDetail } from '@creator-ai-studio/shared';
import { buildYouTubeDescription } from '../seo/description.js';

/**
 * Publish package builder (FASE 3).
 *
 * Collects everything needed for a human-reviewed YouTube publication into
 * `10-publish/`: final metadata plus a checklist of which artifacts exist.
 * Building the package NEVER contacts YouTube — publication is a separate,
 * explicitly authorized step.
 */

export interface PublishChecklistItem {
  key: string;
  label: string;
  ok: boolean;
  detail?: string;
}

export interface PublishPackageResult {
  ok: boolean;
  ready: boolean;
  metadataPath: string;
  checklistPath: string;
  checklist: PublishChecklistItem[];
}

async function writeJsonAtomic(file: string, data: unknown): Promise<void> {
  const tmp = `${file}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  await rename(tmp, file);
}

function resolveShortFiles(episodeDir: string, episode: EpisodeDetail): string[] {
  const fromContent = (episode.content.shorts ?? [])
    .map(s => s.videoPath)
    .filter((p): p is string => Boolean(p?.trim()));
  if (fromContent.length > 0) return fromContent;

  const shortsDir = path.join(episodeDir, '09-shorts');
  if (!existsSync(shortsDir)) return [];

  return readdirSync(shortsDir)
    .filter(name => /^short-\d+\.mp4$/i.test(name))
    .sort()
    .map(name => `09-shorts/${name}`);
}

export async function buildPublishPackage(
  episode: EpisodeDetail,
  episodeDir: string,
): Promise<PublishPackageResult> {
  const publishDir = path.join(episodeDir, '10-publish');
  await mkdir(publishDir, { recursive: true });

  const videoPath = path.join(episodeDir, '06-video', 'episode.mp4');
  const thumbnailPath = path.join(episodeDir, '07-thumbnail', 'thumbnail.png');
  const audioCandidates = ['narration.mp3', 'narration.wav', 'voiceover.mp3'].map(name =>
    path.join(episodeDir, '05-audio', name),
  );

  const title = episode.content.seoTitles[0] ?? episode.title;
  const description = buildYouTubeDescription(
    episode.content.seoDescription,
    episode.content.seoChapters,
  );
  const tags = episode.content.seoTags;
  const shortFiles = resolveShortFiles(episodeDir, episode);
  const legacyShort = path.join(episodeDir, '09-shorts', 'short.mp4');
  const hasShorts =
    shortFiles.length > 0 || existsSync(legacyShort) || (episode.content.shorts?.length ?? 0) > 0;

  const checklist: PublishChecklistItem[] = [
    { key: 'title', label: 'Título definido', ok: title.trim().length > 0, detail: title },
    {
      key: 'description',
      label: 'Descripción SEO',
      ok: description.trim().length > 0,
    },
    { key: 'tags', label: 'Tags SEO', ok: tags.length > 0, detail: `${tags.length} tags` },
    {
      key: 'pinnedComment',
      label: 'Comentario fijado sugerido',
      ok: Boolean(episode.content.pinnedComment?.trim()),
      detail: episode.content.pinnedComment?.slice(0, 80),
    },
    { key: 'script', label: 'Guion generado', ok: episode.content.script.trim().length > 0 },
    { key: 'audio', label: 'Narración (05-audio)', ok: audioCandidates.some(p => existsSync(p)) },
    { key: 'thumbnail', label: 'Miniatura (07-thumbnail)', ok: existsSync(thumbnailPath) },
    { key: 'video', label: 'Video (06-video/episode.mp4)', ok: existsSync(videoPath) },
    {
      key: 'shorts',
      label: 'Shorts (09-shorts/)',
      ok: hasShorts,
      detail: shortFiles.length > 0 ? `${shortFiles.length} archivo(s)` : undefined,
    },
  ];

  const ready = checklist.every(item => item.ok);

  const metadata = {
    episodeId: episode.id,
    title,
    titleOptions: episode.content.seoTitles,
    description,
    tags,
    chapters: episode.content.seoChapters ?? [],
    pinnedComment: episode.content.pinnedComment ?? null,
    categoryId: '22',
    privacyStatus: 'private' as const,
    scheduledAt: episode.content.scheduledAt ?? null,
    videoFile: existsSync(videoPath) ? '06-video/episode.mp4' : null,
    shortFiles: shortFiles.length > 0 ? shortFiles : existsSync(legacyShort) ? ['09-shorts/short.mp4'] : [],
    shorts: episode.content.shorts ?? [],
    thumbnailFile: existsSync(thumbnailPath) ? '07-thumbnail/thumbnail.png' : null,
    generatedAt: new Date().toISOString(),
  };

  const metadataPath = path.join(publishDir, 'metadata.json');
  const checklistPath = path.join(publishDir, 'checklist.json');
  await writeJsonAtomic(metadataPath, metadata);
  await writeJsonAtomic(checklistPath, { ready, items: checklist });

  return { ok: true, ready, metadataPath, checklistPath, checklist };
}
