import type {
  CreateEpisodeInput,
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
