import type { EpisodeDetail, EpisodeSummary } from '@creator-ai-studio/shared';
import type { EpisodeAssetsResponse } from '../api';

export type LibraryFilter = 'all' | 'scripts' | 'scenes' | 'media';

export interface EpisodeLibraryEntry {
  episode: EpisodeSummary;
  assets: EpisodeAssetsResponse;
  detail: EpisodeDetail | null;
}

export function hasScriptAsset(entry: EpisodeLibraryEntry): boolean {
  return (
    entry.assets.files.some(f => f.key === 'script' && f.available) ||
    (entry.detail?.content.script.trim().length ?? 0) > 20
  );
}

export function sceneImageCount(entry: EpisodeLibraryEntry): number {
  const fromAssets = entry.assets.sceneImages?.filter(s => s.available).length ?? 0;
  if (fromAssets > 0) return fromAssets;
  return entry.detail?.content.scenes.filter(s => s.imageUrl?.trim()).length ?? 0;
}

export function mediaAssetCount(entry: EpisodeLibraryEntry): number {
  const mediaKeys = new Set(['video', 'short', 'thumbnail', 'audio']);
  return entry.assets.files.filter(f => mediaKeys.has(f.key) && f.available).length;
}

export function matchesLibraryFilter(entry: EpisodeLibraryEntry, filter: LibraryFilter): boolean {
  switch (filter) {
    case 'scripts':
      return hasScriptAsset(entry);
    case 'scenes':
      return sceneImageCount(entry) > 0 || (entry.detail?.content.scenes.length ?? 0) > 0;
    case 'media':
      return mediaAssetCount(entry) > 0;
    default:
      return true;
  }
}

export function scriptPreview(entry: EpisodeLibraryEntry): string {
  const script = entry.detail?.content.script.trim() ?? '';
  if (!script) return '';
  return script.length > 280 ? `${script.slice(0, 280)}…` : script;
}
