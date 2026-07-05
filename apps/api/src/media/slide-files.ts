import { existsSync, statSync } from 'node:fs';
import path from 'node:path';

/** FFmpeg solid-color placeholders are tiny; real Imagen/DALL-E PNGs are typically much larger. */
export const MIN_REAL_SCENE_SLIDE_BYTES = 65_536;

export function slideFilenameForIndex(index: number): string {
  return `slide-${String(index).padStart(3, '0')}.png`;
}

export function slidePathForIndex(episodeDir: string, index: number): string {
  return path.join(episodeDir, '04-assets', slideFilenameForIndex(index));
}

export function isRealSceneSlideFile(filePath: string): boolean {
  if (!existsSync(filePath)) return false;
  try {
    return statSync(filePath).size >= MIN_REAL_SCENE_SLIDE_BYTES;
  } catch {
    return false;
  }
}
