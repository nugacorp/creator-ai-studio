import { describe, it, expect } from 'vitest';
import {
  episodeFileUrl,
  isLegacyEpisodeAudioUrl,
  normalizeEpisodeContentUrls,
} from '../src/media/media-urls.js';
import type { EpisodeDetail } from '@creator-ai-studio/shared';

function sampleDetail(overrides?: Partial<EpisodeDetail['content']>): EpisodeDetail {
  return {
    id: 'ep-1',
    slug: 'test',
    title: 'Test',
    status: 'draft',
    workspacePath: 'test',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
    content: {
      series: '',
      script: '',
      outline: [],
      scenes: [],
      seoTitles: [],
      seoDescription: '',
      seoTags: [],
      duration: '00:00',
      audioUrl: '/api/episodes/audio/narration.mp3',
      videoUrl: '/api/episodes/media/video',
      ...overrides,
    },
    stages: [],
  };
}

describe('media-urls', () => {
  it('builds canonical file URLs', () => {
    expect(episodeFileUrl('abc', 'audio')).toBe('/api/episodes/abc/files/audio');
  });

  it('detects legacy audio paths', () => {
    expect(isLegacyEpisodeAudioUrl('/api/episodes/audio/narration.mp3')).toBe(true);
    expect(isLegacyEpisodeAudioUrl('/api/episodes/ep-1/files/audio')).toBe(false);
  });

  it('normalizes legacy audio and video URLs on episode detail', () => {
    const normalized = normalizeEpisodeContentUrls(sampleDetail());
    expect(normalized.content.audioUrl).toBe('/api/episodes/ep-1/files/audio');
    expect(normalized.content.videoUrl).toBe('/api/episodes/ep-1/files/video');
  });
});
