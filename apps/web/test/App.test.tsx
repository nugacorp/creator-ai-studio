import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  render,
  screen,
  waitFor,
  fireEvent,
  within,
} from '@testing-library/react';
import type {
  EpisodeDetail,
  EpisodeSummary,
} from '@creator-ai-studio/shared';
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

const sampleDetail: EpisodeDetail = {
  ...sampleEpisode,
  workspacePath: 'ep-1-demo',
  stages: [
    { stage: 'planning', status: 'completed' },
    { stage: 'research', status: 'pending' },
  ],
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
    expect(screen.getByText('No episode selected')).toBeInTheDocument();

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
      expect(
        screen.getByRole('button', { name: /Demo/i }),
      ).toBeInTheDocument(),
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

    await waitFor(() =>
      expect(
        screen.getByRole('button', { name: /Demo/i }),
      ).toBeInTheDocument(),
    );

    expect(fetchMock).toHaveBeenCalledTimes(3);
    expect(fetchMock.mock.calls[1]?.[1]).toMatchObject({ method: 'POST' });
  });

  it('shows episode detail and stages when an episode is selected', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes(`/episodes/${sampleEpisode.id}`)) {
        return jsonResponse(sampleDetail);
      }
      return jsonResponse([sampleEpisode]);
    });

    render(<App />);

    const episodeButton = await screen.findByRole('button', {
      name: /Demo/i,
    });
    fireEvent.click(episodeButton);

    await waitFor(() =>
      expect(
        screen.getByRole('heading', { level: 3, name: 'Demo' }),
      ).toBeInTheDocument(),
    );

    expect(screen.getByText(/Workspace: ep-1-demo/)).toBeInTheDocument();
    expect(screen.getByText(/planning: completed/)).toBeInTheDocument();
    expect(screen.getByText(/research: pending/)).toBeInTheDocument();
    expect(screen.queryByText('No episode selected')).not.toBeInTheDocument();
  });

  it('updates a stage status from the detail view', async () => {
    const updatedDetail: EpisodeDetail = {
      ...sampleDetail,
      stages: [
        { stage: 'planning', status: 'completed' },
        { stage: 'research', status: 'in_progress' },
      ],
    };

    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const method = init?.method ?? 'GET';
      const url = String(input);
      if (method === 'PATCH') {
        return jsonResponse(updatedDetail);
      }
      if (url.includes(`/episodes/${sampleEpisode.id}`)) {
        return jsonResponse(sampleDetail);
      }
      return jsonResponse([sampleEpisode]);
    });

    render(<App />);

    fireEvent.click(await screen.findByRole('button', { name: /Demo/i }));

    const researchRow = (await screen.findByText('research: pending')).closest(
      'li',
    );
    expect(researchRow).not.toBeNull();
    fireEvent.click(
      within(researchRow as HTMLElement).getByRole('button', {
        name: 'in_progress',
      }),
    );

    await waitFor(() =>
      expect(screen.getByText('research: in_progress')).toBeInTheDocument(),
    );
  });

  it('renders the sidebar navigation', () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([]));

    render(<App />);

    const nav = screen.getByRole('navigation', { name: /main navigation/i });
    expect(
      within(nav).getByRole('button', { name: 'Episodes' }),
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole('button', { name: 'Analytics' }),
    ).toBeInTheDocument();
    expect(
      within(nav).getByRole('button', { name: 'Settings' }),
    ).toBeInTheDocument();
  });

  it('navigates to the Analytics placeholder view', async () => {
    vi.spyOn(globalThis, 'fetch').mockResolvedValue(jsonResponse([]));

    render(<App />);

    const nav = screen.getByRole('navigation', { name: /main navigation/i });
    fireEvent.click(within(nav).getByRole('button', { name: 'Analytics' }));

    expect(
      await screen.findByRole('heading', { level: 2, name: 'Analytics' }),
    ).toBeInTheDocument();
    expect(screen.queryByText('No episode selected')).not.toBeInTheDocument();
  });
});
