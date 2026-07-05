import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { Scene } from '@creator-ai-studio/shared';
import { resolveSceneSlides } from '../src/media/render.js';
import { fakeSceneSlideBuffer } from './slide-fixtures.js';

function scene(id: string, index: number, imageUrl = ''): Scene {
  return {
    id,
    text: `Escena ${index + 1}`,
    imageUrl,
    voiceoverPrompt: '',
    musicTrack: '',
    duration: 10,
    transition: 'cut',
  };
}

describe('resolveSceneSlides', () => {
  let episodeDir: string;

  beforeEach(async () => {
    episodeDir = path.join(tmpdir(), `render-slides-${Date.now()}`);
    await mkdir(episodeDir, { recursive: true });
    await mkdir(path.join(episodeDir, '04-assets'), { recursive: true });
  });

  afterEach(async () => {
    await rm(episodeDir, { recursive: true, force: true });
  });

  it('includes every scene when PNGs exist on disk by index', async () => {
    for (let i = 0; i < 6; i++) {
      await writeFile(
        path.join(episodeDir, '04-assets', `slide-${String(i).padStart(3, '0')}.png`),
        fakeSceneSlideBuffer(),
      );
    }
    const scenes = Array.from({ length: 6 }, (_, i) =>
      scene(`s${i}`, i, i < 4 ? `/api/episodes/ep/scene-images/slide-${String(i).padStart(3, '0')}.png` : ''),
    );
    const slides = await resolveSceneSlides(episodeDir, scenes);
    expect(slides).toHaveLength(6);
  });

  it('does not skip scenes missing imageUrl when file exists at index', async () => {
    for (let i = 0; i < 6; i++) {
      await writeFile(
        path.join(episodeDir, '04-assets', `slide-${String(i).padStart(3, '0')}.png`),
        fakeSceneSlideBuffer(),
      );
    }
    const scenes = [
      ...Array.from({ length: 4 }, (_, i) => scene(`s${i}`, i, `/api/episodes/x/scene-images/slide-00${i}.png`)),
      scene('s4', 4, ''),
      scene('s5', 5, ''),
    ];
    const slides = await resolveSceneSlides(episodeDir, scenes);
    expect(slides).toHaveLength(6);
    expect(slides[4]?.path).toContain('slide-004.png');
    expect(slides[5]?.path).toContain('slide-005.png');
  });

  it('rejects placeholder-sized slides in production render', async () => {
    const prev = process.env.ALLOW_MOCKS;
    process.env.ALLOW_MOCKS = 'false';
    try {
      await writeFile(path.join(episodeDir, '04-assets', 'slide-000.png'), Buffer.from([1, 2, 3, 4]));
      const scenes = [scene('s0', 0, '')];
      await expect(resolveSceneSlides(episodeDir, scenes)).rejects.toThrow(/Falta imagen real/);
    } finally {
      if (prev === undefined) delete process.env.ALLOW_MOCKS;
      else process.env.ALLOW_MOCKS = prev;
    }
  });
});
