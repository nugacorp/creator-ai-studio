import { existsSync } from 'node:fs';
import path from 'node:path';
import type { Scene } from '@creator-ai-studio/shared';

/** Keep generated image URLs when rebuilding storyboard from script. */
export function mergeScenesWithExisting(
  parsed: Scene[],
  existing: Scene[],
  episodeDir?: string,
): Scene[] {
  return parsed.map((scene, index) => {
    const prev = existing.find(s => s.id === scene.id) ?? existing[index];
    if (!prev?.imageUrl?.trim()) return scene;

    const filename = prev.imageUrl.split('/').pop();
    const onDisk =
      episodeDir &&
      filename &&
      /^slide-\d{3}\.png$/.test(filename) &&
      existsSync(path.join(episodeDir, '04-assets', filename));

    if (!onDisk && !prev.imageUrl.startsWith('http')) return scene;

    return {
      ...scene,
      imageUrl: prev.imageUrl,
      imagePrompt: prev.imagePrompt ?? scene.imagePrompt,
    };
  });
}
