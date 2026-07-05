import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { Scene } from '@creator-ai-studio/shared';
import { withProvider } from '../ai/router.js';
import { ProviderError } from '../ai/provider-error.js';
import { areMocksAllowed } from '../config/mocks.js';
import { downloadImage } from './render.js';
import { resolveSceneImagePrompt } from './scene-image-refine.js';
import { isRealSceneSlideFile, slideFilenameForIndex, MIN_REAL_SCENE_SLIDE_BYTES } from './slide-files.js';

export interface GenerateSceneImagesResult {
  scenes: Scene[];
  generated: number;
  /** 1-based index of the last processed scene when generating a subset. */
  sceneIndex?: number;
  totalScenes?: number;
}

/** Generate AI images for scenes missing a real on-disk slide; saves PNGs under 04-assets/. */
export async function generateSceneImagesForEpisode(
  episodeId: string,
  episodeDir: string,
  scenes: Scene[],
  episodeTitle: string,
  options?: { sceneIds?: string[]; force?: boolean; skipLlmRefine?: boolean },
): Promise<GenerateSceneImagesResult> {
  const assetsDir = path.join(episodeDir, '04-assets');
  await mkdir(assetsDir, { recursive: true });

  const targetIds = options?.sceneIds?.length ? new Set(options.sceneIds) : null;
  const updated: Scene[] = [];
  let generated = 0;
  let lastProcessedIndex: number | undefined;

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]!;
    if (targetIds && !targetIds.has(scene.id)) {
      updated.push(scene);
      continue;
    }

    lastProcessedIndex = i + 1;
    const dest = path.join(assetsDir, slideFilenameForIndex(i));
    const slideFilename = path.basename(dest);

    if (existsSync(dest) && isRealSceneSlideFile(dest) && !options?.force) {
      updated.push({
        ...scene,
        imageUrl:
          scene.imageUrl?.trim() ||
          `/api/episodes/${episodeId}/scene-images/${slideFilename}`,
      });
      continue;
    }

    const prompt = await resolveSceneImagePrompt(scene, i, episodeTitle, {
      force: options?.force,
      skipLlmRefine: options?.skipLlmRefine,
    });

    let imageUrl: string;
    try {
      imageUrl = await withProvider('image', p =>
        p.generateImage(prompt, { aspectRatio: '16:9', style: 'cinematic biblical' }),
      );
    } catch (error) {
      const detail = error instanceof Error ? error.message : 'Error desconocido';
      throw new ProviderError({
        provider: 'gemini',
        operation: 'image',
        statusCode: 502,
        providerMessage: `No se pudo generar imagen para escena ${i + 1}/${scenes.length}: ${detail}. Revisa GEMINI_API_KEY en Coolify y vuelve a desplegar.`,
        retryable: true,
      });
    }

    const saved = await downloadImage(imageUrl, dest);
    if (!saved || !isRealSceneSlideFile(dest)) {
      if (areMocksAllowed()) {
        await writeFile(dest, Buffer.alloc(MIN_REAL_SCENE_SLIDE_BYTES, 0x41));
      } else {
        throw new ProviderError({
          provider: 'gemini',
          operation: 'image',
          statusCode: 502,
          providerMessage: `La imagen de la escena ${i + 1}/${scenes.length} no se guardó correctamente. Comprueba GEMINI_API_KEY / Imagen 4 y reintenta.`,
          retryable: true,
        });
      }
    }

    updated.push({
      ...scene,
      imageUrl: `/api/episodes/${episodeId}/scene-images/${slideFilename}`,
      imagePrompt: prompt,
    });
    generated++;
  }

  await writeFile(
    path.join(assetsDir, 'scene-assets.json'),
    `${JSON.stringify(updated.map(s => ({ id: s.id, imageUrl: s.imageUrl })), null, 2)}\n`,
    'utf8',
  );

  return {
    scenes: updated,
    generated,
    sceneIndex: lastProcessedIndex,
    totalScenes: scenes.length,
  };
}
