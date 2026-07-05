import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { EpisodeDetail } from '@creator-ai-studio/shared';
import ProjectPipelinePanel from '../src/components/ProjectPipelinePanel';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const episodeDetail: EpisodeDetail = {
  id: 'ep-published',
  slug: 'published-ep',
  title: 'Episodio publicado',
  status: 'published',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
  workspacePath: 'published-ep',
  content: {
    series: 'Reflexiones',
    script: 'Guion de prueba',
    outline: ['Intro'],
    scenes: [],
    seoTitles: [],
    seoDescription: '',
    seoTags: [],
    duration: '05:00',
  },
  stages: [
    { stage: 'planning', status: 'completed' },
    { stage: 'research', status: 'completed' },
    { stage: 'script', status: 'completed' },
    { stage: 'audio', status: 'completed' },
    { stage: 'video', status: 'completed' },
    { stage: 'thumbnail', status: 'completed' },
    { stage: 'seo', status: 'completed' },
    { stage: 'analytics', status: 'in_progress' },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ProjectPipelinePanel stepper navigation', () => {
  it('renders clickable stepper chips for each pipeline column', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/agent-runs')) return jsonResponse({ runs: [] });
      if (url.includes('/episodes/ep-published')) return jsonResponse(episodeDetail);
      return jsonResponse([]);
    });

    render(
      <ProjectPipelinePanel
        episodeId="ep-published"
        projectStatus="Publicado"
        onGoToTab={() => undefined}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Guion/i })).toBeInTheDocument(),
    );

    for (const column of [
      'Ideas',
      'Investigación',
      'Guion',
      'Narración IA',
      'Edición',
      'Miniatura',
      'Programado',
      'Publicado',
    ]) {
      expect(screen.getByRole('button', { name: new RegExp(column, 'i') })).toBeInTheDocument();
    }
  });

  it('calls onGoToTab and shows past-step agent panel when a completed step is clicked', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/agent-runs')) {
        return jsonResponse({
          runs: [
            {
              id: 'run-script',
              agentId: 'scriptwriter',
              status: 'completed',
              startedAt: '2026-07-01T12:00:00.000Z',
              logs: ['Guion generado'],
            },
          ],
        });
      }
      if (url.includes('/episodes/ep-published')) return jsonResponse(episodeDetail);
      return jsonResponse([]);
    });

    const onGoToTab = vi.fn();

    render(
      <ProjectPipelinePanel
        episodeId="ep-published"
        projectStatus="Publicado"
        onGoToTab={onGoToTab}
      />,
    );

    await waitFor(() => expect(screen.getByText(/Analytics/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Guion/i }));

    expect(onGoToTab).toHaveBeenCalledWith('guion');
    await waitFor(() =>
      expect(screen.getByText(/Revisando etapa · Guion/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Guion y escenas/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Guionista/i })).toBeInTheDocument();
  });

  it('navigates to narracion tab when Narración IA step is clicked', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/agent-runs')) return jsonResponse({ runs: [] });
      if (url.includes('/episodes/ep-published')) return jsonResponse(episodeDetail);
      return jsonResponse([]);
    });

    const onGoToTab = vi.fn();

    render(
      <ProjectPipelinePanel
        episodeId="ep-published"
        projectStatus="Publicado"
        onGoToTab={onGoToTab}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Narración IA/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /Narración IA/i }));

    expect(onGoToTab).toHaveBeenCalledWith('narracion');
    await waitFor(() =>
      expect(screen.getByText(/Revisando etapa · Narración IA/i)).toBeInTheDocument(),
    );
  });

  it('runs analytics_agent on double-click of Analista pill', async () => {
    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (method === 'POST' && url.includes('/agents/analytics_agent/run')) {
        return jsonResponse({ ok: true, job: { id: 'job-1' }, message: 'queued' });
      }
      if (url.includes('/agent-runs')) return jsonResponse({ runs: [] });
      if (url.includes('/episodes/ep-published')) return jsonResponse(episodeDetail);
      return jsonResponse([]);
    });

    render(
      <ProjectPipelinePanel
        episodeId="ep-published"
        projectStatus="Publicado"
        onGoToTab={() => undefined}
      />,
    );

    const analista = await screen.findByRole('button', { name: 'Analista' });
    fireEvent.doubleClick(analista);

    await waitFor(() => {
      const runCall = fetchMock.mock.calls.find(
        call =>
          (call[1]?.method ?? 'GET') === 'POST' &&
          String(call[0]).includes('/agents/analytics_agent/run'),
      );
      expect(runCall).toBeTruthy();
    });
  });

  it('calls onGoToTab with analytics when Editar contenido is clicked on Publicado', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/agent-runs')) return jsonResponse({ runs: [] });
      if (url.includes('/episodes/ep-published')) return jsonResponse(episodeDetail);
      return jsonResponse([]);
    });

    const onGoToTab = vi.fn();
    render(
      <ProjectPipelinePanel
        episodeId="ep-published"
        projectStatus="Publicado"
        onGoToTab={onGoToTab}
      />,
    );

    fireEvent.click(await screen.findByRole('button', { name: /Editar contenido/i }));
    expect(onGoToTab).toHaveBeenCalledWith('analytics');
  });

  it('shows Agente de Shorts pill when Edición step is selected', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/agent-runs')) return jsonResponse({ runs: [] });
      if (url.includes('/episodes/ep-published')) return jsonResponse(episodeDetail);
      return jsonResponse([]);
    });

    render(
      <ProjectPipelinePanel
        episodeId="ep-published"
        projectStatus="Edición"
        onGoToTab={() => undefined}
      />,
    );

    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Agente de Shorts' })).toBeInTheDocument(),
    );
  });
});
