import type { EpisodeDetail } from '@creator-ai-studio/shared';
import type { EpisodeStorage } from '../storage/index.js';

/** Returns episode detail or null if missing / owned by another user. */
export async function getEpisodeForUser(
  storage: EpisodeStorage,
  id: string,
  userId?: string,
): Promise<EpisodeDetail | null> {
  const detail = await storage.getEpisode(id);
  if (!detail) return null;
  if (userId && detail.userId && detail.userId !== userId) return null;
  return detail;
}
