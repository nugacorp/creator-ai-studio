import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getReadyMessage,
  buildPipelineStepKeys,
  resolvePipelineMode,
  waitForApiReady,
} from '../src/index.js';

describe('production worker', () => {
  it('reports the ready message', () => {
    expect(getReadyMessage()).toBe('Creator AI Studio production worker ready.');
  });

  it('production-draft excludes YouTube steps', () => {
    const keys = buildPipelineStepKeys('production-draft');
    expect(keys).toContain('script');
    expect(keys).toContain('storyboard');
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

  describe('waitForApiReady', () => {
    const originalFetch = globalThis.fetch;

    afterEach(() => {
      globalThis.fetch = originalFetch;
      delete process.env.WORKER_API_READY_MAX_ATTEMPTS;
      delete process.env.WORKER_API_READY_DELAY_MS;
    });

    it('returns true when health responds on first attempt', async () => {
      globalThis.fetch = vi.fn().mockResolvedValue({ ok: true }) as typeof fetch;
      process.env.WORKER_API_READY_MAX_ATTEMPTS = '3';
      process.env.WORKER_API_READY_DELAY_MS = '1';
      await expect(waitForApiReady()).resolves.toBe(true);
    });

    it('retries and succeeds when API is initially down', async () => {
      let calls = 0;
      globalThis.fetch = vi.fn().mockImplementation(() => {
        calls += 1;
        if (calls < 2) return Promise.reject(new Error('ECONNREFUSED'));
        return Promise.resolve({ ok: true });
      }) as typeof fetch;
      process.env.WORKER_API_READY_MAX_ATTEMPTS = '5';
      process.env.WORKER_API_READY_DELAY_MS = '1';
      await expect(waitForApiReady()).resolves.toBe(true);
      expect(calls).toBeGreaterThanOrEqual(2);
    });

    it('returns false when API never becomes ready', async () => {
      globalThis.fetch = vi.fn().mockRejectedValue(new Error('ECONNREFUSED')) as typeof fetch;
      process.env.WORKER_API_READY_MAX_ATTEMPTS = '2';
      process.env.WORKER_API_READY_DELAY_MS = '1';
      await expect(waitForApiReady()).resolves.toBe(false);
    });
  });
});
