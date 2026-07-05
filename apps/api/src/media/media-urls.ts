import type { EpisodeContent, EpisodeDetail } from '@creator-ai-studio/shared';

export type EpisodeFileAsset = 'audio' | 'music' | 'video' | 'short' | 'thumbnail';

/** Canonical authenticated URL for episode binary assets. */
export function episodeFileUrl(episodeId: string, asset: EpisodeFileAsset): string {
  return `/api/episodes/${episodeId}/files/${asset}`;
}

const LEGACY_AUDIO = /\/api\/episodes\/audio\/narration\.(mp3|wav)/i;

const LEGACY_VIDEO = /\/api\/episodes\/media\/video/i;

export function isLegacyEpisodeAudioUrl(url: string | undefined): boolean {
  if (!url) return false;
  if (LEGACY_AUDIO.test(url)) return true;
  return url.includes('narration.') && !url.includes('/files/');
}

export function normalizeEpisodeContentUrls(detail: EpisodeDetail): EpisodeDetail {
  const content: EpisodeContent = { ...detail.content };
  let changed = false;

  if (isLegacyEpisodeAudioUrl(content.audioUrl)) {
    content.audioUrl = episodeFileUrl(detail.id, 'audio');
    changed = true;
  }
  if (content.videoUrl && LEGACY_VIDEO.test(content.videoUrl)) {
    content.videoUrl = episodeFileUrl(detail.id, 'video');
    changed = true;
  }

  return changed ? { ...detail, content } : detail;
}
