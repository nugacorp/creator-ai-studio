import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { ProductionJob } from '@creator-ai-studio/shared';
import ProductionView from '../src/components/ProductionView';
import type { VideoProject } from '../src/types';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const project: VideoProject = {
  id: 'ep-prod-1',
  title: 'Episodio Render Test',
  series: 'Reflexiones',
  status: 'Edición',
  progress: 60,
  duration: '05:00',
  outline: [],
  script: '',
  scenes: [],
  seoTitles: [],
  seoDescription: '',
  seoTags: [],
};

const activeJob: ProductionJob = {
  id: '11111111-1111-4111-8111-111111111111',
  episodeId: project.id,
  type: 'render',
  status: 'active',
  progress: 42,
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:05:00.000Z',
};

const failedJob: ProductionJob = {
  id: '22222222-2222-4222-8222-222222222222',
  episodeId: project.id,
  type: 'tts',
  status: 'failed',
  progress: 10,
  error: 'ffmpeg no disponible',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:10:00.000Z',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ProductionView', () => {
  it('shows active jobs and failures from the production jobs API', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = String(input);

      if (url.includes('/jobs')) {
        return jsonResponse({
          jobs: [activeJob, failedJob],
          summary: { pending: 0, active: 1, completed: 3, failed: 1 },
        });
      }

      if (url.includes('/system/storage')) {
        return jsonResponse({
          episodesPath: '/tmp/episodes',
          totalBytes: 1,
          usedBytes: 1,
          freeBytes: 1,
          episodesBytes: 1,
          activeEpisodeCount: 1,
          archivedEpisodeCount: 0,
          maxActiveEpisodes: 3,
          diskWarning: false,
          archiveConfigured: false,
          ffmpegAvailable: true,
          piperAvailable: false,
        });
      }

      if (url.includes('/auth/status')) {
        return jsonResponse({ authRequired: false, apiKeyAuth: false, supabaseAuth: false });
      }

      return jsonResponse({});
    });

    render(<ProductionView projects={[project]} />);

    await waitFor(() => {
      expect(screen.getByText('Operaciones en curso')).toBeInTheDocument();
    });

    expect(screen.getAllByText('Episodio Render Test').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('Render de video')).toBeInTheDocument();
    expect(screen.getByText('42%')).toBeInTheDocument();
    expect(screen.getByText('Fallos recientes')).toBeInTheDocument();
    expect(screen.getByText('ffmpeg no disponible')).toBeInTheDocument();
    expect(screen.getAllByText('Ejecutando').length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText('FFmpeg OK')).toBeInTheDocument();
  });

  it('opens workspace when clicking an active job episode', async () => {
    const onOpenWorkspace = vi.fn();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = String(input);
      if (url.includes('/jobs')) {
        return jsonResponse({
          jobs: [activeJob],
          summary: { pending: 0, active: 1, completed: 0, failed: 0 },
        });
      }
      if (url.includes('/system/storage')) {
        return jsonResponse({
          episodesPath: '/tmp',
          totalBytes: 1,
          usedBytes: 1,
          freeBytes: 1,
          episodesBytes: 1,
          activeEpisodeCount: 1,
          archivedEpisodeCount: 0,
          maxActiveEpisodes: 3,
          diskWarning: false,
          archiveConfigured: false,
          ffmpegAvailable: true,
          piperAvailable: true,
        });
      }
      if (url.includes('/auth/status')) {
        return jsonResponse({ authRequired: false });
      }
      return jsonResponse({});
    });

    render(<ProductionView projects={[project]} onOpenWorkspace={onOpenWorkspace} />);

    await waitFor(() => {
      expect(screen.getByText('Render de video')).toBeInTheDocument();
    });

    screen.getAllByText('Episodio Render Test')[0].click();
    expect(onOpenWorkspace).toHaveBeenCalledWith(project.id);
  });
});
