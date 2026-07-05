import { existsSync } from 'node:fs';
import { mkdir, writeFile, rename } from 'node:fs/promises';
import path from 'node:path';
import type { EpisodeDetail } from '@creator-ai-studio/shared';

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

export async function buildPublishPackage(
  episode: EpisodeDetail,
  episodeDir: string,
): Promise<PublishPackageResult> {
  const publishDir = path.join(episodeDir, '10-publish');
  await mkdir(publishDir, { recursive: true });

  const videoPath = path.join(episodeDir, '06-video', 'episode.mp4');
  const shortPath = path.join(episodeDir, '09-shorts', 'short.mp4');
  const thumbnailPath = path.join(episodeDir, '07-thumbnail', 'thumbnail.png');
  const audioCandidates = ['narration.mp3', 'narration.wav', 'voiceover.mp3'].map(name =>
    path.join(episodeDir, '05-audio', name),
  );

  const title = episode.content.seoTitles[0] ?? episode.title;
  const description = episode.content.seoDescription;
  const tags = episode.content.seoTags;

  const checklist: PublishChecklistItem[] = [
    { key: 'title', label: 'Título definido', ok: title.trim().length > 0, detail: title },
    {
      key: 'description',
      label: 'Descripción SEO',
      ok: description.trim().length > 0,
    },
    { key: 'tags', label: 'Tags SEO', ok: tags.length > 0, detail: `${tags.length} tags` },
    { key: 'script', label: 'Guion generado', ok: episode.content.script.trim().length > 0 },
    { key: 'audio', label: 'Narración (05-audio)', ok: audioCandidates.some(p => existsSync(p)) },
    { key: 'thumbnail', label: 'Miniatura (07-thumbnail)', ok: existsSync(thumbnailPath) },
    { key: 'video', label: 'Video (06-video/episode.mp4)', ok: existsSync(videoPath) },
    { key: 'shorts', label: 'Short (09-shorts/short.mp4)', ok: existsSync(shortPath) },
  ];

  const ready = checklist.every(item => item.ok);

  const metadata = {
    episodeId: episode.id,
    title,
    titleOptions: episode.content.seoTitles,
    description,
    tags,
    categoryId: '22',
    // Safety default: never public. A human upgrades visibility manually.
    privacyStatus: 'private' as const,
    scheduledAt: episode.content.scheduledAt ?? null,
    videoFile: existsSync(videoPath) ? '06-video/episode.mp4' : null,
    shortFile: existsSync(shortPath) ? '09-shorts/short.mp4' : null,
    thumbnailFile: existsSync(thumbnailPath) ? '07-thumbnail/thumbnail.png' : null,
    generatedAt: new Date().toISOString(),
  };

  const metadataPath = path.join(publishDir, 'metadata.json');
  const checklistPath = path.join(publishDir, 'checklist.json');
  await writeJsonAtomic(metadataPath, metadata);
  await writeJsonAtomic(checklistPath, { ready, items: checklist });

  return { ok: true, ready, metadataPath, checklistPath, checklist };
}
