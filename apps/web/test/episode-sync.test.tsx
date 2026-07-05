import { describe, it, expect, vi, afterEach } from 'vitest';
import { renderHook, waitFor, act } from '@testing-library/react';
import type { ProductionJob } from '@creator-ai-studio/shared';
import { useEpisodeSync } from '../src/hooks/useEpisodeSync';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const episodeId = 'ep-sync-1';

const baseDetail = {
  id: episodeId,
  slug: 'sync-test',
  title: 'Sync Test Episode',
  status: 'scripting',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  workspacePath: 'sync-test',
  content: {
    series: 'Reflexiones',
    script: '',
    outline: ['Punto 1', 'Punto 2'],
    scenes: [],
    seoTitles: [],
    seoDescription: '',
    seoTags: [],
    duration: '00:00',
  },
  stages: [{ stage: 'script', status: 'pending' as const, expectedFiles: [] }],
};

const generatedScript =
  '**[INTRO]**\n\nGuion generado por pipeline automático.\n\n' +
  'Este texto supera el umbral mínimo para detectar sincronización desde el servidor hacia el editor supervisado.';

const activeRenderJob: ProductionJob = {
  id: 'job-render-1',
  episodeId,
  type: 'render',
  status: 'active',
  progress: 70,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:05:00.000Z',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('useEpisodeSync', () => {
  it('polls and applies script content when background job completes', async () => {
    let detail = baseDetail;
    let jobs: ProductionJob[] = [activeRenderJob];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = String(input);

      if (url.includes(`/episodes/${episodeId}/jobs`)) return jsonResponse(jobs);
      if (url.includes('/agent-runs')) return jsonResponse({ runs: [] });
      if (url.includes(`/episodes/${episodeId}/assets`)) {
        return jsonResponse({
          episodeId,
          workspacePath: 'sync-test',
          storageLocation: 'local',
          files: [
            { key: 'script', label: 'Guion', available: false },
            { key: 'video', label: 'Video MP4', available: false, filename: 'episode.mp4' },
          ],
        });
      }
      if (url.includes(`/episodes/${episodeId}`)) return jsonResponse(detail);
      return jsonResponse([]);
    });

    const { result } = renderHook(() => useEpisodeSync(episodeId));

    await waitFor(() => expect(result.current.detail).not.toBeNull());
    expect(result.current.isBackgroundActive).toBe(true);
    expect(result.current.jobProgress).toBe(70);

    jobs = [];
    detail = {
      ...baseDetail,
      content: { ...baseDetail.content, script: generatedScript },
    };

    await act(async () => {
      await result.current.refresh();
    });

    await waitFor(() => expect(result.current.detail?.content.script).toBe(generatedScript));
    expect(result.current.notice?.text).toContain('Guion actualizado');
  });
});

describe('PipelinePanel asset sync', () => {
  it('shows in-progress label for video asset during render job', async () => {
    const { inProgressAssetKeys } = await import('../src/lib/episodeJobLabels');
    const map = inProgressAssetKeys([activeRenderJob]);
    expect(map.get('video')).toBeTruthy();
  });
});
