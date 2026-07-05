import { describe, it, expect } from 'vitest';
import {
  getReadyMessage,
  buildPipelineStepKeys,
  resolvePipelineMode,
} from '../src/index.js';

describe('production worker', () => {
  it('reports the ready message', () => {
    expect(getReadyMessage()).toBe('Creator AI Studio production worker ready.');
  });

  it('production-draft excludes YouTube steps', () => {
    const keys = buildPipelineStepKeys('production-draft');
    expect(keys).toContain('script');
    expect(keys).toContain('publish_package');
    expect(keys).not.toContain('publish');
    expect(keys).not.toContain('confirm');
  });

  it('ready-for-review adds review step only', () => {
    const keys = buildPipelineStepKeys('ready-for-review');
    expect(keys).toContain('review');
    expect(keys).not.toContain('publish');
  });

  it('publish-authorized includes YouTube upload and confirm', () => {
    const keys = buildPipelineStepKeys('publish-authorized');
    expect(keys).toContain('publish');
    expect(keys).toContain('confirm');
  });

  it('defaults unknown mode to production-draft', () => {
    expect(resolvePipelineMode({ id: '1', episodeId: 'e', type: 'pipeline', status: 'pending' })).toBe(
      'production-draft',
    );
    expect(
      resolvePipelineMode({
        id: '1',
        episodeId: 'e',
        type: 'pipeline',
        status: 'pending',
        payload: { mode: 'publish-authorized' },
      }),
    ).toBe('publish-authorized');
  });
});
