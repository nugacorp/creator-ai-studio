import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, within } from '@testing-library/react';
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

const sampleEpisode: EpisodeSummary = {
  id: 'ep-1',
  slug: 'demo-real',
  title: 'Episodio Real Demo',
  status: 'draft',
  createdAt: '2026-06-25T00:00:00.000Z',
  updatedAt: '2026-06-25T00:00:00.000Z',
};

const SIDEBAR_ITEMS = [
  'Home',
  'Proyectos',
  'Contenido',
  'IA Copilot',
  'Biblioteca IA',
  'Publicaciones',
  'Analytics',
  'Automatización',
  'Agentes IA',
  'Modo Producción',
  'Modo Multicanal',
  'Equipos',
  'Configuración',
];

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Official dashboard shell', () => {
  it('renders the full official sidebar navigation', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/status')) {
        return jsonResponse({ authRequired: false, apiKeyAuth: false, supabaseAuth: false });
      }
      return jsonResponse([]);
    });

    renderApp('projects');

    await waitFor(() => expect(screen.getByRole('navigation')).toBeInTheDocument());

    const nav = screen.getByRole('navigation');
    for (const label of SIDEBAR_ITEMS) {
      expect(within(nav).getByRole('button', { name: label })).toBeInTheDocument();
    }
  });

  it('renders home dashboard without crashing before episodes load', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/status')) {
        return jsonResponse({ authRequired: false, apiKeyAuth: false, supabaseAuth: false });
      }
      return new Promise(() => {});
    });

    renderApp('home');

    await waitFor(() =>
      expect(screen.getByText(/Buenos días|Buenas tardes|Buenas noches/)).toBeInTheDocument(),
    );
    expect(document.getElementById('quick-actions-fab')).toBeInTheDocument();
  });

  it('loads real episodes from the backend into the Projects view', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/auth/status')) {
        return jsonResponse({ authRequired: false, apiKeyAuth: false, supabaseAuth: false });
      }
      if (url.includes('/episodes/ep-1')) {
        return jsonResponse({
          ...sampleEpisode,
          workspacePath: 'ep-1-demo',
          content: {
            series: 'Reflexiones',
            script: '',
            outline: [],
            scenes: [],
            seoTitles: [],
            seoDescription: '',
            seoTags: [],
            duration: '00:00',
          },
          stages: [],
        });
      }
      if (url.includes('/episodes')) {
        return jsonResponse([sampleEpisode]);
      }
      if (url.includes('/channels')) {
        return jsonResponse([]);
      }
      return jsonResponse([]);
    });

    renderApp('projects');

    await waitFor(() =>
      expect(screen.getByText(/Episodio Real Demo/)).toBeInTheDocument(),
    );

    expect(screen.queryByText(/Moisés/)).not.toBeInTheDocument();
  });
});
