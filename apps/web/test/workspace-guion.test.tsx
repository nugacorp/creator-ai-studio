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
  id: 'rut-fe-outline-ep',
  slug: 'rut-fe-outline',
  title: 'Rut: Ejemplo de fe para las generaciones actuales',
  status: 'scripting',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const outlinePoints = [
  'Introducción: fe en tiempos difíciles',
  'Contexto del libro de Rut',
  'La decisión de Rut de quedarse',
  'Boaz y la provisión de Dios',
  'Redención y linaje',
  'Aplicación para hoy',
  'Versículos clave',
  'Cierre y llamado a la acción',
];

const generatedScript =
  '**[INTRO]**\n\nEn tiempos de incertidumbre, la fe de Rut nos enseña a confiar en Dios.\n\n' +
  'Este guion fue generado por el agente Guionista desde el outline aprobado.';

function buildEpisodeDetail(script = '') {
  return {
    ...episode,
    workspacePath: 'rut-fe-outline',
    content: {
      series: 'Reflexiones',
      script,
      outline: outlinePoints,
      scenes: [],
      seoTitles: [],
      seoDescription: '',
      seoTags: [],
      duration: '00:00',
    },
    stages: [
      { stage: 'research', status: 'completed' as const, expectedFiles: [] },
      { stage: 'script', status: 'pending' as const, expectedFiles: [] },
    ],
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Workspace Guion generate script', () => {
  it('shows Generar guion con IA when outline exists and script is empty', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/agent-runs')) return jsonResponse({ runs: [] });
      if (url.includes('/storage/stats')) {
        return jsonResponse({ episodes: 1, totalBytes: 0, diskFreeBytes: 1_000_000 });
      }
      if (url.includes(`/episodes/${episode.id}/assets`)) {
        return jsonResponse({
          episodeId: episode.id,
          workspacePath: 'rut-fe-outline',
          storageLocation: 'local',
          files: [],
        });
      }
      if (url.includes(`/episodes/${episode.id}`)) return jsonResponse(buildEpisodeDetail());
      if (url.includes('/auth/status')) {
        return jsonResponse({ authRequired: false, apiKeyAuth: false, supabaseAuth: false });
      }
      if (url.includes('/episodes')) return jsonResponse([episode]);
      return jsonResponse([]);
    });

    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: /Editar Workspace/i }));

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Generar guion con IA/i }),
      ).toBeInTheDocument(),
    );

    expect(screen.getByText(/Outline listo — genera el guion con el agente guionista/i)).toBeInTheDocument();
    expect(screen.getByText(/8 puntos en el outline/i)).toBeInTheDocument();
    expect(screen.getByText(/Outline listo — genera arriba/i)).toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: /Generar guion con IA/i })).toHaveLength(1);
  });

  it('calls scriptwriter agent and loads generated script into the editor', async () => {
    let jobPolls = 0;
    let episodeDetail = buildEpisodeDetail();

    const fetchMock = vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (method === 'POST' && url.includes('/agents/scriptwriter/run')) {
        return jsonResponse(
          { job: { id: 'job-scriptwriter-1', status: 'pending', type: 'agent' }, message: 'queued' },
          202,
        );
      }
      if (url.includes('/jobs/job-scriptwriter-1')) {
        jobPolls += 1;
        return jsonResponse({
          id: 'job-scriptwriter-1',
          status: 'completed',
          type: 'agent',
          episodeId: episode.id,
        });
      }
      if (url.includes('/agent-runs')) return jsonResponse({ runs: [] });
      if (url.includes('/storage/stats')) {
        return jsonResponse({ episodes: 1, totalBytes: 0, diskFreeBytes: 1_000_000 });
      }
      if (url.includes(`/episodes/${episode.id}/assets`)) {
        return jsonResponse({
          episodeId: episode.id,
          workspacePath: 'rut-fe-outline',
          storageLocation: 'local',
          files: [],
        });
      }
      if (url.includes(`/episodes/${episode.id}`) && method === 'PATCH') {
        return jsonResponse(episodeDetail);
      }
      if (url.includes(`/episodes/${episode.id}`)) {
        if (jobPolls >= 1) {
          episodeDetail = {
            ...buildEpisodeDetail(generatedScript),
            stages: [
              { stage: 'research', status: 'completed' as const, expectedFiles: [] },
              { stage: 'script', status: 'pending' as const, expectedFiles: [] },
            ],
          };
        }
        return jsonResponse(episodeDetail);
      }
      if (url.includes('/auth/status')) {
        return jsonResponse({ authRequired: false, apiKeyAuth: false, supabaseAuth: false });
      }
      if (url.includes('/episodes')) return jsonResponse([episode]);
      return jsonResponse([]);
    });

    renderApp();
    fireEvent.click(await screen.findByRole('button', { name: /Editar Workspace/i }));

    const generateButton = await screen.findByRole('button', { name: /Generar guion con IA/i });
    fireEvent.click(generateButton);

    await waitFor(() => {
      const runCall = fetchMock.mock.calls.find(
        call =>
          (call[1]?.method ?? 'GET') === 'POST' &&
          String(call[0]).includes('/agents/scriptwriter/run'),
      );
      expect(runCall).toBeTruthy();
    });

    const scriptField = await screen.findByPlaceholderText(/Comienza a redactar tu guion bíblico/i);
    await waitFor(() => expect(scriptField).toHaveValue(generatedScript), { timeout: 8000 });
    expect(jobPolls).toBeGreaterThanOrEqual(1);
  });
});
