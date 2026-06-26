import { describe, it, expect } from 'vitest';
import {
  EPISODE_STAGE_STATUSES,
  EPISODE_STAGES,
  EPISODE_STATUSES,
  type CreateEpisodeInput,
  type EpisodeStageState,
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

  it('includes all official production stages, in order', () => {
    expect(EPISODE_STAGES).toEqual([
      'planning',
      'research',
      'script',
      'doctrine_review',
      'editorial_review',
      'storyboard',
      'assets',
      'audio',
      'video',
      'thumbnail',
      'seo',
      'shorts',
      'final_review',
      'publishing',
      'analytics',
    ]);
  });

  it('defines the four official stage statuses', () => {
    expect(EPISODE_STAGE_STATUSES).toEqual([
      'pending',
      'in_progress',
      'completed',
      'blocked',
    ]);
  });

  it('allows constructing a stage state', () => {
    const state: EpisodeStageState = { stage: 'script', status: 'in_progress' };
    expect(state.stage).toBe('script');
    expect(EPISODE_STAGE_STATUSES).toContain(state.status);
  });
});
