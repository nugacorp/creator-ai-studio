import { describe, expect, it } from 'vitest';
import type { EpisodeSummary, ProductionJob } from '@creator-ai-studio/shared';
import {
  episodeIdsWithActiveJobs,
  isArchivableEpisode,
  pickEpisodesToArchive,
} from '../src/archive/policy.js';

function episode(partial: Partial<EpisodeSummary> & Pick<EpisodeSummary, 'id'>): EpisodeSummary {
  return {
    slug: partial.slug ?? 'test',
    title: partial.title ?? 'Test',
    status: partial.status ?? 'published',
    createdAt: partial.createdAt ?? '2026-01-01T00:00:00.000Z',
    updatedAt: partial.updatedAt ?? '2026-01-01T00:00:00.000Z',
    ...partial,
  };
}

function job(partial: Partial<ProductionJob> & Pick<ProductionJob, 'episodeId' | 'type'>): ProductionJob {
  return {
    id: partial.id ?? 'job-1',
    status: partial.status ?? 'active',
    progress: partial.progress ?? 10,
    createdAt: partial.createdAt ?? '2026-01-02T00:00:00.000Z',
    updatedAt: partial.updatedAt ?? '2026-01-02T00:00:00.000Z',
    ...partial,
  };
}

describe('archive policy', () => {
  it('marks episodes with active pipeline jobs as busy', () => {
    const busy = episodeIdsWithActiveJobs([
      job({ episodeId: 'a', type: 'pipeline', status: 'active' }),
      job({ episodeId: 'b', type: 'render', status: 'completed' }),
    ]);
    expect(busy.has('a')).toBe(true);
    expect(busy.has('b')).toBe(false);
  });

  it('only auto-archives published episodes without active jobs', () => {
    const busy = new Set<string>();
    expect(isArchivableEpisode(episode({ id: '1', status: 'published' }), busy)).toBe(true);
    expect(isArchivableEpisode(episode({ id: '2', status: 'rendering' }), busy)).toBe(false);
    expect(isArchivableEpisode(episode({ id: '3', status: 'review' }), busy)).toBe(false);
    expect(isArchivableEpisode(episode({ id: '4', archiveStatus: 'archived' }), busy)).toBe(false);
  });

  it('picks oldest published episodes when over the active limit', () => {
    const episodes = [
      episode({ id: 'old', createdAt: '2026-01-01T00:00:00.000Z', status: 'published' }),
      episode({ id: 'mid', createdAt: '2026-02-01T00:00:00.000Z', status: 'published' }),
      episode({ id: 'new', createdAt: '2026-03-01T00:00:00.000Z', status: 'review' }),
      episode({ id: 'busy', createdAt: '2025-12-01T00:00:00.000Z', status: 'published' }),
    ];
    const busy = new Set(['busy']);
    const picked = pickEpisodesToArchive(episodes, busy, 3);
    expect(picked.map(e => e.id)).toEqual(['old']);
  });

  it('archives enough episodes to return under the limit', () => {
    const episodes = [
      episode({ id: 'e1', createdAt: '2026-01-01T00:00:00.000Z', status: 'published' }),
      episode({ id: 'e2', createdAt: '2026-02-01T00:00:00.000Z', status: 'published' }),
      episode({ id: 'e3', createdAt: '2026-03-01T00:00:00.000Z', status: 'published' }),
      episode({ id: 'e4', createdAt: '2026-04-01T00:00:00.000Z', status: 'published' }),
    ];
    const picked = pickEpisodesToArchive(episodes, new Set(), 3);
    expect(picked.map(e => e.id)).toEqual(['e1']);
  });
});
