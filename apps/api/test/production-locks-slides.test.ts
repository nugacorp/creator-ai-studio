import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import type { Scene } from '@creator-ai-studio/shared';
import { allScenesHaveStoredImages } from '../src/media/production-locks.js';
import { fakeSceneSlideBuffer } from './slide-fixtures.js';

function scene(id: string): Scene {
  return {
    id,
    text: 'Escena',
    imageUrl: '',
    voiceoverPrompt: '',
    musicTrack: '',
    duration: 5,
    transition: 'cut',
  };
}

describe('allScenesHaveStoredImages', () => {
  let tmpDir: string;

  beforeEach(async () => {
    tmpDir = path.join(os.tmpdir(), `cas-locks-${Date.now()}`);
    await mkdir(path.join(tmpDir, '04-assets'), { recursive: true });
  });

  afterEach(async () => {
    await rm(tmpDir, { recursive: true, force: true });
  });

  it('returns false when only ffmpeg placeholder slides exist', async () => {
    await writeFile(path.join(tmpDir, '04-assets', 'slide-000.png'), Buffer.from([1, 2, 3, 4]));
    await writeFile(path.join(tmpDir, '04-assets', 'slide-001.png'), Buffer.from([1, 2, 3, 4]));
    expect(allScenesHaveStoredImages(tmpDir, [scene('a'), scene('b')])).toBe(false);
  });

  it('returns true when every indexed slide is a real image file', async () => {
    await writeFile(path.join(tmpDir, '04-assets', 'slide-000.png'), fakeSceneSlideBuffer());
    await writeFile(path.join(tmpDir, '04-assets', 'slide-001.png'), fakeSceneSlideBuffer());
    expect(allScenesHaveStoredImages(tmpDir, [scene('a'), scene('b')])).toBe(true);
  });
});
