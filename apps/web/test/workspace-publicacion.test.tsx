import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
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
  slug: 'publicacion-flow',
  title: 'Publicacion Flow Test',
  status: 'draft',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const episodeDetail = {
  ...episode,
  workspacePath: 'publicacion-flow',
  content: {
    series: 'Reflexiones',
    script: 'Guion de prueba.',
    outline: ['Intro'],
    scenes: [],
    seoTitles: ['Título SEO'],
    seoDescription: 'Descripción SEO',
    seoTags: ['fe'],
    duration: '00:00',
  },
  stages: [{ stage: 'publishing', status: 'pending' as const, expectedFiles: [] }],
};

function futureScheduleDate(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Workspace Publicación tab', () => {
  it('shows error (not fake success) when YouTube OAuth is missing', async () => {
    const patchBodies: unknown[] = [];
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      if (url.includes('/agent-runs')) return jsonResponse({ runs: [] });
      if (url.includes('/storage/stats')) {
        return jsonResponse({ episodes: 1, totalBytes: 0, diskFreeBytes: 1_000_000 });
      }
      if (url.includes('/secrets')) {
        return jsonResponse({
          encryptionAvailable: false,
          items: [{ provider: 'youtube', configured: false, authMethod: 'none', source: 'none' }],
        });
      }
      if (url.includes(`/episodes/${episode.id}/jobs`)) return jsonResponse([]);
      if (url.includes(`/episodes/${episode.id}/assets`)) {
        return jsonResponse({
          episodeId: episode.id,
          workspacePath: episodeDetail.workspacePath,
          storageLocation: 'local',
          files: [],
        });
      }
      if (url.includes(`/episodes/${episode.id}`) && init?.method === 'PATCH') {
        patchBodies.push(JSON.parse(String(init.body)));
        return jsonResponse({
          ...episodeDetail,
          content: {
            ...episodeDetail.content,
            ...(JSON.parse(String(init.body)) as { content?: { scheduledAt?: string } }).content,
          },
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
      expect(document.querySelector('[data-workspace-tabs]')).toBeTruthy(),
    );
    const tabs = document.querySelector('[data-workspace-tabs]') as HTMLElement;
    fireEvent.click(within(tabs).getByText('Publicación'));

    const dateInput = document.querySelector('input[type="date"]') as HTMLInputElement;
    expect(dateInput).toBeTruthy();
    const future = futureScheduleDate();
    fireEvent.change(dateInput, { target: { value: future } });

    fireEvent.click(screen.getByRole('button', { name: /Confirmar Programación del Video/i }));

    await waitFor(() => {
      expect(patchBodies.length).toBeGreaterThan(0);
    });
    expect(
      patchBodies.some(body => {
        const content = (body as { content?: { scheduledAt?: string } }).content;
        return Boolean(content?.scheduledAt);
      }),
    ).toBe(true);

    await waitFor(() =>
      expect(
        screen.getByText(/YouTube no está conectado/i),
      ).toBeInTheDocument(),
    );
  });
});
