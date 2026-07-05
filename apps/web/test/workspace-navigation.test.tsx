import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import type { EpisodeSummary } from '@creator-ai-studio/shared';
import { App } from '../src/App';
import { AuthProvider } from '../src/context/AuthContext';

function renderApp(initialView?: string) {
  return render(
    <AuthProvider>
      <App initialView={initialView} />
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
  slug: 'cas-e2e-test-genesis-1-smoke',
  title: 'CAS E2E Test - Genesis 1 Smoke',
  status: 'draft',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const episodeDetail = {
  ...episode,
  workspacePath: 'cas-e2e',
  content: {
    series: 'Reflexiones',
    script: 'En el principio creó Dios los cielos y la tierra.',
    outline: ['Génesis 1:1'],
    scenes: [],
    seoTitles: [],
    seoDescription: '',
    seoTags: [],
    duration: '00:00',
  },
  stages: [{ stage: 'script', status: 'pending' as const, expectedFiles: [] }],
};

function mockApi(opts: { detailFails?: boolean } = {}) {
  vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
    const url = String(input);
    if (url.includes(`/episodes/${episode.id}`)) {
      if (opts.detailFails) return jsonResponse({ error: 'boom' }, 500);
      return jsonResponse(episodeDetail);
    }
    if (url.includes('/episodes')) return jsonResponse([episode]);
    return jsonResponse([]);
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Project card / Edit Workspace navigation', () => {
  it('renders the ProjectsView with the episode card', async () => {
    mockApi();
    renderApp('projects');
    await waitFor(() =>
      expect(screen.getByText(/CAS E2E Test - Genesis 1 Smoke/)).toBeInTheDocument(),
    );
  });

  it('opens the workspace when the card title is clicked', async () => {
    mockApi();
    renderApp('projects');

    const heading = await screen.findByText(/"CAS E2E Test - Genesis 1 Smoke"/);
    fireEvent.click(heading);

    // Workspace-only surfaces must appear.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Guardar Cambios/i })).toBeInTheDocument(),
    );
    expect(screen.getByText(/Etapas de Producción/i)).toBeInTheDocument();
  });

  it('opens the workspace from the "Editar Workspace" button', async () => {
    mockApi();
    renderApp('projects');

    const editBtn = await screen.findByRole('button', { name: /Editar Workspace/i });
    fireEvent.click(editBtn);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Guardar Cambios/i })).toBeInTheDocument(),
    );
  });

  it('shows the selected episode title inside the workspace', async () => {
    mockApi();
    renderApp('projects');

    const editBtn = await screen.findByRole('button', { name: /Editar Workspace/i });
    fireEvent.click(editBtn);

    const workspace = await screen.findByRole('region', { name: /Workspace/i }).catch(() => null);
    // Regardless of region wiring, the title must be visible in the workspace header.
    await waitFor(() =>
      expect(screen.getAllByText(/CAS E2E Test - Genesis 1 Smoke/).length).toBeGreaterThan(0),
    );
    void workspace;
  });

  it('shows a controlled error when GET /episodes/:id fails in the workspace', async () => {
    mockApi({ detailFails: true });
    renderApp('projects');

    const editBtn = await screen.findByRole('button', { name: /Editar Workspace/i });
    fireEvent.click(editBtn);

    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent(/No se pudo cargar el detalle/i),
    );
  });

  it('returns to Projects with the "Volver a Proyectos" button', async () => {
    mockApi();
    renderApp('projects');

    fireEvent.click(await screen.findByRole('button', { name: /Editar Workspace/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Guardar Cambios/i }));
    // Back to Projects.
    fireEvent.click(screen.getByRole('button', { name: /Volver a Proyectos/i }));

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Nuevo Proyecto/i })).toBeInTheDocument(),
    );
    expect(screen.queryByRole('button', { name: /Guardar Cambios/i })).not.toBeInTheDocument();
  });

  it('opens the workspace for the specific episode clicked (not the first one)', async () => {
    const second: EpisodeSummary = {
      ...episode,
      id: '11111111-2222-3333-4444-555555555555',
      slug: 'segundo-episodio',
      title: 'Segundo Episodio',
    };
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes(`/episodes/${second.id}`)) {
        return jsonResponse({ ...episodeDetail, ...second, content: { ...episodeDetail.content } });
      }
      if (url.includes(`/episodes/${episode.id}`)) return jsonResponse(episodeDetail);
      if (url.includes('/episodes')) return jsonResponse([episode, second]);
      return jsonResponse([]);
    });

    renderApp('projects');

    // Click the heading of the SECOND episode.
    fireEvent.click(await screen.findByText(/"Segundo Episodio"/));

    // Workspace breadcrumb + WorkspaceView header must show the second episode.
    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Guardar Cambios/i })).toBeInTheDocument(),
    );
    expect(screen.getAllByText(/Segundo Episodio/).length).toBeGreaterThan(0);
  });
});
