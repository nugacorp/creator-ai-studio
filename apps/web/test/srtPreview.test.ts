import { describe, it, expect } from 'vitest';
import { parseSrtCueTexts, formatTimelineClock } from '../src/lib/srtPreview';

describe('srtPreview', () => {
  it('parses cue text from SRT blocks', () => {
    const srt = `1
00:00:00,000 --> 00:00:03,000
Primera línea

2
00:00:03,000 --> 00:00:06,000
Segunda línea`;
    expect(parseSrtCueTexts(srt)).toEqual(['Primera línea', 'Segunda línea']);
  });

  it('formats seconds as mm:ss', () => {
    expect(formatTimelineClock(65)).toBe('01:05');
    expect(formatTimelineClock(0)).toBe('00:00');
  });
});
