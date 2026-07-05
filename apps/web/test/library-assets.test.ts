import { describe, it, expect } from 'vitest';
import {
  hasScriptAsset,
  matchesLibraryFilter,
  mediaAssetCount,
  sceneImageCount,
  scriptPreview,
  type EpisodeLibraryEntry,
} from '../src/lib/libraryAssets';

const baseEntry = (overrides: Partial<EpisodeLibraryEntry> = {}): EpisodeLibraryEntry => ({
  episode: {
    id: 'ep-1',
    slug: 'demo',
    title: 'Demo',
    status: 'draft',
    createdAt: '2026-01-01T00:00:00.000Z',
    updatedAt: '2026-01-01T00:00:00.000Z',
  },
  assets: {
    episodeId: 'ep-1',
    workspacePath: 'demo',
    storageLocation: 'local',
    files: [],
    sceneImages: [],
  },
  detail: null,
  ...overrides,
});

describe('libraryAssets', () => {
  it('detects script from assets or detail', () => {
    expect(hasScriptAsset(baseEntry())).toBe(false);
    expect(
      hasScriptAsset(
        baseEntry({
          assets: {
            ...baseEntry().assets,
            files: [{ key: 'script', label: 'Guion', available: true }],
          },
        }),
      ),
    ).toBe(true);
    expect(
      hasScriptAsset(
        baseEntry({
          detail: {
            ...baseEntry().episode,
            workspacePath: 'demo',
            content: {
              series: 'Reflexiones',
              script: 'Un guion suficientemente largo para contar.',
              outline: [],
              scenes: [],
              seoTitles: [],
              seoDescription: '',
              seoTags: [],
              duration: '00:00',
            },
            stages: [],
          },
        }),
      ),
    ).toBe(true);
  });

  it('counts scene images from assets sceneImages', () => {
    const entry = baseEntry({
      assets: {
        ...baseEntry().assets,
        sceneImages: [
          {
            sceneId: 's1',
            index: 0,
            label: 'Escena 1',
            filename: 'slide-000.png',
            available: true,
            imageUrl: '/api/episodes/ep-1/scene-images/slide-000.png',
          },
          {
            sceneId: 's2',
            index: 1,
            label: 'Escena 2',
            filename: 'slide-001.png',
            available: false,
          },
        ],
      },
    });
    expect(sceneImageCount(entry)).toBe(1);
    expect(matchesLibraryFilter(entry, 'scenes')).toBe(true);
    expect(matchesLibraryFilter(entry, 'media')).toBe(false);
  });

  it('counts media files', () => {
    const entry = baseEntry({
      assets: {
        ...baseEntry().assets,
        files: [
          { key: 'video', label: 'Video', available: true },
          { key: 'audio', label: 'Audio', available: true },
        ],
      },
    });
    expect(mediaAssetCount(entry)).toBe(2);
    expect(matchesLibraryFilter(entry, 'media')).toBe(true);
  });

  it('truncates script preview', () => {
    const long = 'a'.repeat(400);
    const entry = baseEntry({
      detail: {
        ...baseEntry().episode,
        workspacePath: 'demo',
        content: {
          series: 'Reflexiones',
          script: long,
          outline: [],
          scenes: [],
          seoTitles: [],
          seoDescription: '',
          seoTags: [],
          duration: '00:00',
        },
        stages: [],
      },
    });
    const preview = scriptPreview(entry);
    expect(preview.endsWith('…')).toBe(true);
    expect(preview.length).toBeLessThan(long.length);
  });
});
