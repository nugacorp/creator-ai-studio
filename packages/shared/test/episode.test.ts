import { describe, it, expect } from 'vitest';
import {
  EPISODE_STATUSES,
  type CreateEpisodeInput,
  type EpisodeSummary,
} from '../src/index.js';

describe('shared episode model', () => {
  it('exposes the episode lifecycle statuses', () => {
    expect(EPISODE_STATUSES).toContain('draft');
    expect(EPISODE_STATUSES).toContain('published');
    expect(EPISODE_STATUSES.length).toBeGreaterThan(0);
  });

  it('allows constructing a valid episode summary', () => {
    const now = new Date(0).toISOString();
    const episode: EpisodeSummary = {
      id: 'ep-001',
      slug: 'pilot',
      title: 'Pilot',
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    expect(episode.status).toBe('draft');
    expect(episode.slug).toBe('pilot');
    expect(EPISODE_STATUSES).toContain(episode.status);
  });

  it('describes the create episode input', () => {
    const input: CreateEpisodeInput = { title: 'Pilot' };
    expect(input.title).toBe('Pilot');
  });
});
