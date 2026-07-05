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
  slug: 'seo-optimize-test',
  title: 'David vs Goliat',
  status: 'draft',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const scriptIntro = '# David vs Goliat\n\n## Introducción\nBienvenidos a una nueva reflexión.';

const seoResponse = {
  titles: ['David vs Goliat | Reflexión Cristiana', '¿Qué dice la Biblia sobre David?'],
  description: 'En este video exploramos David vs Goliat: una reflexión cristiana basada en la Palabra.',
  tags: ['reflexion', 'cristiana', 'david'],
};

const episodeDetail = {
  ...episode,
  workspacePath: 'seo-optimize-test',
  content: {
    series: 'Reflexiones',
    script: scriptIntro,
    outline: ['Intro'],
    scenes: [],
    seoTitles: [],
    seoDescription: scriptIntro.substring(0, 80),
    seoTags: [],
    duration: '00:00',
  },
  stages: [{ stage: 'seo', status: 'pending' as const, expectedFiles: [] }],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Workspace SEO optimize', () => {
  it('updates SEO fields in UI and persists via PATCH after Optimizar con IA', async () => {
    const patchCalls: { body: unknown }[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

      if (url.includes('/agent-runs')) return jsonResponse({ runs: [] });
      if (url.includes('/storage/stats')) {
        return jsonResponse({ episodes: 1, totalBytes: 0, diskFreeBytes: 1_000_000 });
      }
      if (url.includes('/gemini/seo') && method === 'POST') {
        return jsonResponse(seoResponse);
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
        patchCalls.push({ body: JSON.parse(String(init?.body ?? '{}')) });
        return jsonResponse({
          ...episodeDetail,
          content: {
            ...episodeDetail.content,
            seoTitles: seoResponse.titles,
            seoDescription: seoResponse.description,
            seoTags: seoResponse.tags,
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
      expect(screen.getByRole('button', { name: /SEO/i })).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByRole('button', { name: /SEO/i }));

    const descriptionField = await screen.findByPlaceholderText(/descripción de tu video/i);
    expect(descriptionField).toHaveValue(scriptIntro.substring(0, 80));

    fireEvent.click(screen.getByRole('button', { name: /Optimizar con IA/i }));

    await waitFor(() => {
      expect(descriptionField).toHaveValue(seoResponse.description);
    });

    await waitFor(() => expect(patchCalls.length).toBeGreaterThan(0));

    const lastPatch = patchCalls[patchCalls.length - 1]!.body as {
      content: { seoTitles: string[]; seoDescription: string; seoTags: string[] };
    };
    expect(lastPatch.content.seoTitles).toEqual(seoResponse.titles);
    expect(lastPatch.content.seoDescription).toBe(seoResponse.description);
    expect(lastPatch.content.seoTags).toEqual(seoResponse.tags);
  });
});
