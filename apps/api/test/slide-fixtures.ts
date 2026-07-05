import { describe, it, expect } from 'vitest';
import { MIN_REAL_SCENE_SLIDE_BYTES } from '../src/media/slide-files.js';

/** Minimal PNG header + padding so tests pass real-slide size checks. */
export function fakeSceneSlideBuffer(): Buffer {
  const buf = Buffer.alloc(MIN_REAL_SCENE_SLIDE_BYTES);
  buf[0] = 0x89;
  buf[1] = 0x50;
  buf[2] = 0x4e;
  buf[3] = 0x47;
  return buf;
}

describe('fakeSceneSlideBuffer', () => {
  it('meets minimum real slide byte threshold', () => {
    expect(fakeSceneSlideBuffer().length).toBeGreaterThanOrEqual(MIN_REAL_SCENE_SLIDE_BYTES);
  });
});
