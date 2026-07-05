import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { Scene } from '@creator-ai-studio/shared';
import { generateSceneImagesForEpisode } from '../src/media/scene-images.js';
import { fakeSceneSlideBuffer } from './slide-fixtures.js';

function scene(id: string, text: string): Scene {
  return {
    id,
    text,
    imageUrl: '',
    voiceoverPrompt: '',
    musicTrack: 'Peaceful Ambient Piano',
    duration: 5,
    transition: 'Fade',
  };
}

describe('generateSceneImagesForEpisode reuse', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `cas-scene-reuse-${Date.now()}`);
    await mkdir(tmpDir, { recursive: true });
    await mkdir(path.join(tmpDir, '04-assets'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('reuses slide-XXX.png on disk without regenerating when force is false', async () => {
    const slidePath = path.join(tmpDir, '04-assets', 'slide-000.png');
    await writeFile(slidePath, fakeSceneSlideBuffer());

    const scenes = [scene('s1', 'Escena existente')];
    const result = await generateSceneImagesForEpisode('ep-reuse', tmpDir, scenes, 'Título', {
      skipLlmRefine: true,
    });

    expect(result.generated).toBe(0);
    expect(result.scenes[0]?.imageUrl).toBe('/api/episodes/ep-reuse/scene-images/slide-000.png');
  });

  it('preserves existing imageUrl when slide file exists', async () => {
    const slidePath = path.join(tmpDir, '04-assets', 'slide-000.png');
    await writeFile(slidePath, fakeSceneSlideBuffer());

    const existingUrl = '/api/episodes/ep-reuse/scene-images/slide-000.png';
    const scenes = [{ ...scene('s1', 'Escena'), imageUrl: existingUrl }];
    const result = await generateSceneImagesForEpisode('ep-reuse', tmpDir, scenes, 'Título', {
      skipLlmRefine: true,
    });

    expect(result.generated).toBe(0);
    expect(result.scenes[0]?.imageUrl).toBe(existingUrl);
  });
});
