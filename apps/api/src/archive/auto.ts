import type { EpisodeSummary } from '@creator-ai-studio/shared';
import { archiveEpisodeWorkspace, isArchiveConfigured } from './drive.js';
import { episodeIdsWithActiveJobs, pickEpisodesToArchive } from './policy.js';
import { listAllJobs } from '../jobs/store.js';
import { getSettings } from '../settings/store.js';
import { resolveStoragePath, type EpisodeStorage } from '../storage/index.js';

export interface AutoArchiveResult {
  triggered: boolean;
  archived: Array<{ id: string; title: string; drivePath?: string }>;
  skippedReason?: string;
  errors: string[];
}

let lastAutoArchiveAttemptMs = 0;
const AUTO_ARCHIVE_COOLDOWN_MS = 5 * 60 * 1000;

async function archiveOne(
  storage: EpisodeStorage,
  episode: EpisodeSummary,
): Promise<{ ok: boolean; drivePath?: string; message: string }> {
  const detail = await storage.getEpisode(episode.id);
  if (!detail) {
    return { ok: false, message: `episodio ${episode.id} no encontrado` };
  }
  const dir = await storage.getEpisodeDirectory(episode.id);
  if (!dir) {
    return { ok: false, message: `episodio ${episode.id} ya no está en disco` };
  }

  const result = await archiveEpisodeWorkspace(resolveStoragePath(), detail.workspacePath);
  if (result.ok && result.drivePath) {
    await storage.markArchived(episode, result.drivePath, detail.workspacePath);
  }
  return result;
}

/**
 * When local episode count exceeds maxActiveEpisodes, archive oldest published
 * episodes to Google Drive (if RCLONE_REMOTE is configured).
 */
export async function autoArchiveOverLimit(
  storage: EpisodeStorage,
  options: { force?: boolean; requirePublished?: boolean } = {},
): Promise<AutoArchiveResult> {
  const result: AutoArchiveResult = { triggered: false, archived: [], errors: [] };

  if (!isArchiveConfigured()) {
    result.skippedReason = 'RCLONE_REMOTE no configurado';
    return result;
  }

  const now = Date.now();
  if (!options.force && now - lastAutoArchiveAttemptMs < AUTO_ARCHIVE_COOLDOWN_MS) {
    result.skippedReason = 'cooldown';
    return result;
  }
  lastAutoArchiveAttemptMs = now;

  const settings = await getSettings();
  const episodes = await storage.listLocalEpisodes();
  const activeCount = episodes.filter(e => e.archiveStatus !== 'archived').length;
  if (activeCount <= settings.maxActiveEpisodes) {
    result.skippedReason = 'within limit';
    return result;
  }

  const jobs = await listAllJobs({ status: ['pending', 'active'], limit: 500 });
  const busy = episodeIdsWithActiveJobs(jobs);
  const toArchive = pickEpisodesToArchive(
    episodes,
    busy,
    settings.maxActiveEpisodes,
    { requirePublished: options.requirePublished ?? true },
  );

  if (toArchive.length === 0) {
    result.skippedReason = 'no archivable published episodes (active jobs or still in production)';
    return result;
  }

  result.triggered = true;
  for (const episode of toArchive) {
    const archived = await archiveOne(storage, episode);
    if (archived.ok) {
      result.archived.push({
        id: episode.id,
        title: episode.title,
        drivePath: archived.drivePath,
      });
    } else {
      result.errors.push(`${episode.title}: ${archived.message}`);
    }
  }

  return result;
}
