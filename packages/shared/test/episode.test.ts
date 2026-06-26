import { describe, it, expect } from 'vitest';
import { EPISODE_STATUSES, type EpisodeSummary } from '../src/index.js';

describe('shared episode model', () => {
  it('exposes the episode lifecycle statuses', () => {
    expect(EPISODE_STATUSES).toContain('draft');
    expect(EPISODE_STATUSES).toContain('published');
    expect(EPISODE_STATUSES.length).toBeGreaterThan(0);
  });

  it('allows constructing a valid episode summary', () => {
    const episode: EpisodeSummary = {
      id: 'ep-001',
      title: 'Pilot',
      status: 'draft',
      createdAt: new Date(0).toISOString(),
    };

    expect(episode.status).toBe('draft');
    expect(EPISODE_STATUSES).toContain(episode.status);
  });
});
