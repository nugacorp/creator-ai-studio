import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { EpisodeSummary } from '@creator-ai-studio/shared';
import { App } from '../src/App';
import { AuthProvider } from '../src/context/AuthContext';

function renderApp() {
  return render(
    <AuthProvider>
      <App initialView="projects" />
    </AuthProvider>,
  );
}

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const episode: EpisodeSummary = {
  id: '61c9f34c-ad99-4580-aa96-891d1ac35607',
  slug: 'approve-flow-test',
  title: 'Approve Flow Test',
  status: 'draft',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const episodeDetail = {
  ...episode,
  workspacePath: 'approve-flow',
  content: {
    series: 'Reflexiones',
    script: 'Guion largo de prueba con más de veinte caracteres para aprobar la sección.',
    outline: ['Intro'],
    scenes: [],
    seoTitles: [],
    seoDescription: '',
    seoTags: [],
    subtitlesSrt: '',
    duration: '00:00',
  },
  stages: [
    { stage: 'script', status: 'pending' as const, expectedFiles: [] },
    { stage: 'subtitles', status: 'pending' as const, expectedFiles: [] },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Workspace approve flow', () => {
  it('shows Subtítulos tab and per-section approve buttons', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/agent-runs')) return jsonResponse({ runs: [] });
      if (url.includes('/storage/stats')) {
        return jsonResponse({ episodes: 1, totalBytes: 0, diskFreeBytes: 1_000_000 });
      }
      if (url.includes(`/episodes/${episode.id}/assets`)) {
        return jsonResponse({
          episodeId: episode.id,
          workspacePath: episodeDetail.workspacePath,
          storageLocation: 'local',
          files: [],
        });
      }
      if (url.includes(`/episodes/${episode.id}`)) return jsonResponse(episodeDetail);
      if (url.includes('/auth/status')) {
        return jsonResponse({ authRequired: false, apiKeyAuth: false, supabaseAuth: false });
      }
      if (url.includes('/episodes')) return jsonResponse([episode]);
      return jsonResponse([]);
    });

    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: /Editar Workspace/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /^Subtítulos/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /^Guion/i }));
    expect(screen.getByRole('button', { name: /Aprobar sección/i })).toBeInTheDocument();
  });

  it('PATCHes stage to completed when approving guion', async () => {
    const stagePatches: string[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.includes('/stages/script') && method === 'PATCH') {
        stagePatches.push('script');
        return jsonResponse({
          ...episodeDetail,
          stages: [{ stage: 'script', status: 'completed', expectedFiles: [] }],
        });
      }
      if (url.includes('/agent-runs')) return jsonResponse({ runs: [] });
      if (url.includes('/storage/stats')) {
        return jsonResponse({ episodes: 1, totalBytes: 0, diskFreeBytes: 1_000_000 });
      }
      if (url.includes(`/episodes/${episode.id}/assets`)) {
        return jsonResponse({
          episodeId: episode.id,
          workspacePath: episodeDetail.workspacePath,
          storageLocation: 'local',
          files: [],
        });
      }
      if (url.includes(`/episodes/${episode.id}`) && method === 'PATCH') {
        return jsonResponse(episodeDetail);
      }
      if (url.includes(`/episodes/${episode.id}`)) return jsonResponse(episodeDetail);
      if (url.includes('/auth/status')) {
        return jsonResponse({ authRequired: false, apiKeyAuth: false, supabaseAuth: false });
      }
      if (url.includes('/episodes')) return jsonResponse([episode]);
      return jsonResponse([]);
    });

    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: /Editar Workspace/i }));
    fireEvent.click(await screen.findByRole('button', { name: /^Guion/i }));

    const approveBtn = await screen.findByRole('button', { name: /Aprobar sección/i });
    fireEvent.click(approveBtn);

    await waitFor(() => expect(stagePatches).toContain('script'));
  });
});
