import { describe, it, expect } from 'vitest';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { isRealSceneSlideFile, slidePathForIndex } from '../src/media/slide-files.js';
import { fakeSceneSlideBuffer } from './slide-fixtures.js';

describe('slide-files', () => {
  it('treats tiny PNGs as placeholders, not real scene slides', async () => {
    const dir = path.join(tmpdir(), `slide-files-${Date.now()}`);
    await mkdir(dir, { recursive: true });
    const tiny = path.join(dir, 'tiny.png');
    await writeFile(tiny, Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a]));
    expect(isRealSceneSlideFile(tiny)).toBe(false);
    await rm(dir, { recursive: true, force: true });
  });

  it('accepts slides at or above the real-slide byte threshold', async () => {
    const dir = path.join(tmpdir(), `slide-files-real-${Date.now()}`);
    const episodeDir = path.join(dir, 'ep');
    await mkdir(path.join(episodeDir, '04-assets'), { recursive: true });
    const slidePath = slidePathForIndex(episodeDir, 2);
    await writeFile(slidePath, fakeSceneSlideBuffer());
    expect(isRealSceneSlideFile(slidePath)).toBe(true);
    await rm(dir, { recursive: true, force: true });
  });
});
