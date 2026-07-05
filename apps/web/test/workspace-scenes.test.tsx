import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { EpisodeSummary, Scene } from '@creator-ai-studio/shared';
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
  slug: 'scene-delete-test',
  title: 'Scene Delete Test',
  status: 'draft',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

const sceneA: Scene = {
  id: 'sc_a',
  text: 'Primera escena',
  imageUrl: '',
  voiceoverPrompt: '',
  musicTrack: 'Peaceful Ambient Piano',
  duration: 5,
  transition: 'Fade',
};

const sceneB: Scene = {
  id: 'sc_b',
  text: 'Segunda escena',
  imageUrl: '',
  voiceoverPrompt: '',
  musicTrack: 'Peaceful Ambient Piano',
  duration: 5,
  transition: 'Fade',
};

const episodeDetail = {
  ...episode,
  workspacePath: 'scene-delete-test',
  content: {
    series: 'Reflexiones',
    script: 'Guion de prueba.',
    outline: [],
    scenes: [sceneA, sceneB],
    seoTitles: [],
    seoDescription: '',
    seoTags: [],
    duration: '00:00',
  },
  stages: [{ stage: 'script', status: 'pending' as const, expectedFiles: [] }],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Workspace scene deletion', () => {
  it('persists scene deletion via PATCH /episodes/:id', async () => {
    const patchCalls: { body: unknown }[] = [];

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';

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
        return jsonResponse(episodeDetail);
      }

      if (url.includes(`/episodes/${episode.id}`)) {
        return jsonResponse(episodeDetail);
      }

      if (url.includes('/auth/status')) {
        return jsonResponse({ authRequired: false, apiKeyAuth: false, supabaseAuth: false });
      }

      if (url.includes('/episodes')) {
        return jsonResponse([episode]);
      }

      return jsonResponse([]);
    });

    renderApp('projects');

    fireEvent.click(await screen.findByRole('button', { name: /Editar Workspace/i }));
    fireEvent.click(await screen.findByRole('button', { name: /Escenas/i }));

    const deleteButtons = await screen.findAllByTitle('Borrar escena');
    expect(deleteButtons).toHaveLength(2);

    fireEvent.click(deleteButtons[0]!);

    await waitFor(() => expect(patchCalls.length).toBeGreaterThan(0));

    const lastPatch = patchCalls[patchCalls.length - 1]!.body as {
      content: { scenes: Scene[] };
    };
    expect(lastPatch.content.scenes).toHaveLength(1);
    expect(lastPatch.content.scenes[0]?.id).toBe('sc_b');
  });
});
