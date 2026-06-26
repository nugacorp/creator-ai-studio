import type {
  CreateEpisodeInput,
  EpisodeDetail,
  EpisodeSummary,
} from '@creator-ai-studio/shared';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

/** Fetch all episodes from the API. */
export async function fetchEpisodes(): Promise<EpisodeSummary[]> {
  const response = await fetch(`${API_BASE_URL}/episodes`);
  if (!response.ok) {
    throw new Error(`Failed to load episodes (${response.status})`);
  }
  return (await response.json()) as EpisodeSummary[];
}

/** Fetch full detail for a single episode. */
export async function fetchEpisodeDetail(id: string): Promise<EpisodeDetail> {
  const response = await fetch(
    `${API_BASE_URL}/episodes/${encodeURIComponent(id)}`,
  );
  if (!response.ok) {
    throw new Error(`Failed to load episode (${response.status})`);
  }
  return (await response.json()) as EpisodeDetail;
}

/** Create a new episode via the API. */
export async function createEpisode(
  input: CreateEpisodeInput,
): Promise<EpisodeSummary> {
  const response = await fetch(`${API_BASE_URL}/episodes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  });
  if (!response.ok) {
    throw new Error(`Failed to create episode (${response.status})`);
  }
  return (await response.json()) as EpisodeSummary;
}
