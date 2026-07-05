import { describe, expect, it } from 'vitest';
import type { EpisodeContent } from '@creator-ai-studio/shared';
import { sceneContentSignature, stagesToInvalidate } from '../src/media/production-locks.js';
import { mergeScenesWithExisting } from '../src/media/merge-scenes.js';

describe('production-locks', () => {
  const base: EpisodeContent = {
    series: 'Reflexiones',
    script: 'Guion original largo para pruebas de bloqueo de producción aprobada.',
    outline: [],
    scenes: [{ id: 'scene-1', text: 'Bosque', imageUrl: '/api/x/slide-000.png', voiceoverPrompt: '', musicTrack: '', duration: 8, transition: 'Fade' }],
    seoTitles: [],
    seoDescription: '',
    seoTags: [],
    duration: '00:00',
  };

  it('invalidates downstream stages when script changes', () => {
    const next = { ...base, script: 'Guion editado por el usuario con nuevo contenido.' };
    const stages = stagesToInvalidate(base, next);
    expect(stages).toContain('storyboard');
    expect(stages).toContain('assets');
    expect(stages).toContain('audio');
    expect(stages).toContain('subtitles');
  });

  it('does not invalidate assets when only imageUrl changes', () => {
    const next = {
      ...base,
      scenes: [{ ...base.scenes[0]!, imageUrl: '/api/x/slide-000.png?v=2' }],
    };
    expect(sceneContentSignature(base.scenes)).toBe(sceneContentSignature(next.scenes));
    expect(stagesToInvalidate(base, next)).not.toContain('assets');
  });

  it('invalidates assets when scene text changes', () => {
    const next = {
      ...base,
      scenes: [{ ...base.scenes[0]!, text: 'Océano al atardecer' }],
    };
    expect(stagesToInvalidate(base, next)).toContain('assets');
  });
});

describe('mergeScenesWithExisting', () => {
  it('preserves imageUrl from existing scenes by id', () => {
    const merged = mergeScenesWithExisting(
      [{ id: 'scene-1', text: 'Nuevo texto', imageUrl: '', voiceoverPrompt: '', musicTrack: '', duration: 8, transition: 'Fade' }],
      [{ id: 'scene-1', text: 'Viejo', imageUrl: 'https://example.com/img.png', voiceoverPrompt: '', musicTrack: '', duration: 8, transition: 'Fade' }],
    );
    expect(merged[0]?.imageUrl).toBe('https://example.com/img.png');
  });
});
