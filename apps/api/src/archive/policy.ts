import type { EpisodeSummary, ProductionJob } from '@creator-ai-studio/shared';

const PRODUCTION_JOB_TYPES = new Set([
  'script',
  'tts',
  'render',
  'thumbnail',
  'shorts',
  'publish',
  'publish_package',
  'pipeline',
  'archive',
  'agent',
]);

/** Episodes with pending/active production jobs must stay on disk. */
export function episodeIdsWithActiveJobs(jobs: ProductionJob[]): Set<string> {
  const busy = new Set<string>();
  for (const job of jobs) {
    if (job.status !== 'pending' && job.status !== 'active') continue;
    if (PRODUCTION_JOB_TYPES.has(job.type)) {
      busy.add(job.episodeId);
    }
  }
  return busy;
}

/** Published episodes on local disk that are safe to move to cold storage. */
export function isArchivableEpisode(
  episode: EpisodeSummary,
  busyEpisodeIds: Set<string>,
  options: { requirePublished?: boolean } = {},
): boolean {
  if (episode.archiveStatus === 'archived') return false;
  if (busyEpisodeIds.has(episode.id)) return false;

  const requirePublished = options.requirePublished ?? true;
  if (requirePublished) {
    return episode.status === 'published';
  }

  // Manual archive: allow review/draft only when caller opts out of requirePublished.
  return episode.status !== 'scripting' && episode.status !== 'rendering';
}

/**
 * Pick the oldest local episodes to archive until count is at or below the limit.
 * Only published episodes without active jobs are considered for automatic eviction.
 */
export function pickEpisodesToArchive(
  episodes: EpisodeSummary[],
  busyEpisodeIds: Set<string>,
  maxActive: number,
  options: { requirePublished?: boolean } = {},
): EpisodeSummary[] {
  const activeOnDisk = episodes.filter(e => e.archiveStatus !== 'archived');
  const overBy = activeOnDisk.length - maxActive;
  if (overBy <= 0) return [];

  const candidates = activeOnDisk
    .filter(e => isArchivableEpisode(e, busyEpisodeIds, options))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  return candidates.slice(0, overBy);
}
