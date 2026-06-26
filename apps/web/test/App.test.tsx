import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import type { EpisodeSummary } from '@creator-ai-studio/shared';
import { App } from '../src/App';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const sampleEpisode: EpisodeSummary = {
  id: 'ep-1',
  slug: 'demo',
  title: 'Demo',
  status: 'draft',
  createdAt: '2026-06-25T00:00:00.000Z',
  updatedAt: '2026-06-25T00:00:00.000Z',
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('App', () => {
  it('renders the title, subtitle and empty state', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([]));

    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Creator AI Studio' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('YouTube Christian Bible Channel Production System'),
    ).toBeInTheDocument();

    await waitFor(() =>
      expect(screen.getByText('No episodes created yet')).toBeInTheDocument(),
    );
  });

  it('renders episodes returned by the API', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(
      jsonResponse([sampleEpisode]),
    );

    render(<App />);

    await waitFor(() =>
      expect(screen.getByText(/Demo/)).toBeInTheDocument(),
    );
    expect(screen.queryByText('No episodes created yet')).not.toBeInTheDocument();
  });

  it('creates an episode and refreshes the list', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(jsonResponse(sampleEpisode, 201))
      .mockResolvedValueOnce(jsonResponse([sampleEpisode]));

    render(<App />);

    await waitFor(() =>
      expect(screen.getByText('No episodes created yet')).toBeInTheDocument(),
    );

    fireEvent.change(screen.getByLabelText('Title'), {
      target: { value: 'Demo' },
    });
    fireEvent.click(screen.getByRole('button', { name: /create episode/i }));

    await waitFor(() => expect(screen.getByText(/Demo/)).toBeInTheDocument());

    expect(fetchMock).toHaveBeenCalledTimes(3);
    const postCall = fetchMock.mock.calls[1];
    expect(postCall?.[1]).toMatchObject({ method: 'POST' });
  });
});
