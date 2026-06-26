import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, within, fireEvent } from '@testing-library/react';
import type { EpisodeDetail } from '@creator-ai-studio/shared';
import ProductionStagesPanel from '../src/components/ProductionStagesPanel';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const detail: EpisodeDetail = {
  id: 'ep-1',
  slug: 'demo',
  title: 'Demo',
  status: 'draft',
  createdAt: '2026-06-25T00:00:00.000Z',
  updatedAt: '2026-06-25T00:00:00.000Z',
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
  stages: [
    { stage: 'planning', status: 'completed' },
    { stage: 'research', status: 'pending' },
  ],
};

const updatedDetail: EpisodeDetail = {
  ...detail,
  stages: [
    { stage: 'planning', status: 'completed' },
    { stage: 'research', status: 'in_progress' },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('ProductionStagesPanel (backend-connected)', () => {
  it('loads episode detail and updates a stage via PATCH', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockImplementation(async (input, init) => {
        const method = init?.method ?? 'GET';
        if (method === 'PATCH') {
          return jsonResponse(updatedDetail);
        }
        return jsonResponse(detail);
      });

    render(<ProductionStagesPanel episodeId="ep-1" />);

    // GET /episodes/:id detail rendered.
    const researchLabel = await screen.findByText('research');
    const researchRow = researchLabel.closest('li');
    expect(researchRow).not.toBeNull();

    fireEvent.click(
      within(researchRow as HTMLElement).getByRole('button', {
        name: 'in_progress',
      }),
    );

    await waitFor(() => {
      const patchCall = fetchMock.mock.calls.find(
        (call) => (call[1]?.method ?? 'GET') === 'PATCH',
      );
      expect(patchCall).toBeTruthy();
      expect(String(patchCall?.[0])).toContain(
        '/episodes/ep-1/stages/research',
      );
    });
  });
});
