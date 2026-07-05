import { describe, expect, it } from 'vitest';
import type { EpisodeContent } from '@creator-ai-studio/shared';
import { generateSubtitlesSrt } from '../src/media/subtitles.js';

describe('subtitles generation', () => {
  const base: EpisodeContent = {
    series: 'Reflexiones',
    script: '',
    outline: [],
    scenes: [
      {
        id: 's1',
        text: 'En el principio',
        voiceoverPrompt: 'En el principio creó Dios',
        imageUrl: '',
        musicTrack: '',
        duration: 4,
        transition: 'Fade',
      },
      {
        id: 's2',
        text: 'La luz',
        voiceoverPrompt: 'Y dijo: sea la luz',
        imageUrl: '',
        musicTrack: '',
        duration: 3,
        transition: 'Fade',
      },
    ],
    seoTitles: [],
    seoDescription: '',
    seoTags: [],
    duration: '00:00',
  };

  it('builds SRT cues from scene voiceover and duration', () => {
    const srt = generateSubtitlesSrt(base);
    expect(srt).toContain('00:00:00,000 --> 00:00:04,000');
    expect(srt).toContain('En el principio creó Dios');
    expect(srt).toContain('00:00:04,000 --> 00:00:07,000');
    expect(srt).toContain('Y dijo: sea la luz');
  });

  it('falls back to script paragraphs when scenes are empty', () => {
    const srt = generateSubtitlesSrt({
      ...base,
      scenes: [],
      script: 'Primer párrafo del guion.\n\nSegundo párrafo con más texto.',
    });
    expect(srt).toContain('Primer párrafo del guion');
    expect(srt).toContain('Segundo párrafo');
  });
});
