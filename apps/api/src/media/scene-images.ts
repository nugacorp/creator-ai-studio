import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Scene } from '@creator-ai-studio/shared';
import { withProvider } from '../ai/router.js';
import { downloadImage } from './render.js';
import { resolveSceneImagePrompt } from './scene-image-refine.js';

export interface GenerateSceneImagesResult {
  scenes: Scene[];
  generated: number;
}

/** Generate AI images for scenes missing imageUrl; saves PNGs under 04-assets/. */
export async function generateSceneImagesForEpisode(
  episodeId: string,
  episodeDir: string,
  scenes: Scene[],
  episodeTitle: string,
  options?: { sceneIds?: string[]; force?: boolean },
): Promise<GenerateSceneImagesResult> {
  const assetsDir = path.join(episodeDir, '04-assets');
  await mkdir(assetsDir, { recursive: true });

  const targetIds = options?.sceneIds?.length ? new Set(options.sceneIds) : null;
  const updated: Scene[] = [];
  let generated = 0;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]!;
    if (targetIds && !targetIds.has(scene.id)) {
      updated.push(scene);
      continue;
    }
    const dest = path.join(assetsDir, `slide-${String(i).padStart(3, '0')}.png`);
    const hasStoredImage = scene.imageUrl?.trim() && existsSync(dest);
    if (hasStoredImage && !options?.force) {
      updated.push(scene);
      continue;
    }

    const prompt = await resolveSceneImagePrompt(scene, i, episodeTitle, {
      force: options?.force,
    });
    const imageUrl = await withProvider('image', p =>
      p.generateImage(prompt, { aspectRatio: '16:9', style: 'cinematic biblical' }),
    );

    const saved = await downloadImage(imageUrl, dest);
    if (!saved) {
      updated.push({ ...scene, imageUrl, imagePrompt: prompt });
      generated++;
      continue;
    }

    updated.push({
      ...scene,
      imageUrl: `/api/episodes/${episodeId}/scene-images/${path.basename(dest)}`,
      imagePrompt: prompt,
    });
    generated++;
  }

  await writeFile(
    path.join(assetsDir, 'scene-assets.json'),
    `${JSON.stringify(updated.map(s => ({ id: s.id, imageUrl: s.imageUrl })), null, 2)}\n`,
    'utf8',
  );

  return { scenes: updated, generated };
}
