import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { EpisodeSummary } from '@creator-ai-studio/shared';
import LibraryView from '../src/components/LibraryView';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const episode: EpisodeSummary = {
  id: 'lib-ep-1',
  slug: 'biblioteca-test',
  title: 'Episodio Biblioteca',
  status: 'draft',
  createdAt: '2026-07-01T00:00:00.000Z',
  updatedAt: '2026-07-01T00:00:00.000Z',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('LibraryView', () => {
  it('lists episode assets and opens workspace from Usar en proyecto', async () => {
    const onOpenWorkspace = vi.fn();

    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = String(input);

      if (url.includes(`/episodes/${episode.id}/assets`)) {
        return jsonResponse({
          episodeId: episode.id,
          workspacePath: episode.slug,
          storageLocation: 'local',
          files: [
            { key: 'script', label: 'Guion', available: true, filename: 'guion.txt' },
            { key: 'video', label: 'Video', available: false },
          ],
          sceneImages: [
            {
              sceneId: 'sc_1',
              index: 0,
              label: 'Escena 1',
              filename: 'slide-000.png',
              available: true,
              imageUrl: `/api/episodes/${episode.id}/scene-images/slide-000.png`,
              text: 'Primera escena',
            },
          ],
        });
      }

      if (url.includes(`/episodes/${episode.id}`)) {
        return jsonResponse({
          ...episode,
          workspacePath: episode.slug,
          content: {
            series: 'Reflexiones',
            script: 'Guion de prueba para la biblioteca con suficiente texto.',
            outline: [],
            scenes: [{ id: 'sc_1', text: 'Primera escena', imageUrl: '', voiceoverPrompt: '', musicTrack: '', duration: 5, transition: 'Fade' }],
            seoTitles: [],
            seoDescription: '',
            seoTags: [],
            duration: '00:00',
          },
          stages: [],
        });
      }

      if (url.includes('/episodes')) {
        return jsonResponse([episode]);
      }

      if (url.includes('/auth/status')) {
        return jsonResponse({ authRequired: false, apiKeyAuth: false, supabaseAuth: false });
      }

      return jsonResponse([]);
    });

    render(
      <LibraryView onAddNewScript={vi.fn()} onOpenWorkspace={onOpenWorkspace} />,
    );

    expect(await screen.findByText('Episodio Biblioteca')).toBeTruthy();
    expect(screen.getByText(/Imágenes de escena/)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Usar en proyecto' }));
    expect(onOpenWorkspace).toHaveBeenCalledWith('lib-ep-1', 'escenas');

    fireEvent.click(screen.getByRole('button', { name: 'Expandir' }));
    await waitFor(() => {
      expect(screen.getByText(/Guion de prueba/)).toBeTruthy();
    });
    expect(screen.getByText('slide-000.png')).toBeTruthy();
  });

  it('shows plantillas tab without standalone image generator', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = String(input);
      if (url.includes('/episodes')) return jsonResponse([]);
      if (url.includes('/auth/status')) {
        return jsonResponse({ authRequired: false, apiKeyAuth: false, supabaseAuth: false });
      }
      return jsonResponse([]);
    });

    render(<LibraryView onAddNewScript={vi.fn()} onOpenWorkspace={vi.fn()} />);

    await waitFor(() => {
      expect(screen.getByText('Explorar activos')).toBeTruthy();
    });

    fireEvent.click(screen.getByRole('button', { name: /Plantillas de guion/i }));
    expect(screen.getByText(/Plantilla de guion con IA/i)).toBeTruthy();
    expect(screen.queryByText(/Generador de Imágenes IA/i)).toBeNull();
    expect(screen.queryByText(/Modelar Imagen IA/i)).toBeNull();
  });
});
