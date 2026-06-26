/**
 * Shared domain types for Creator AI Studio.
 *
 * These describe the production lifecycle of an episode. No real content is
 * produced here — only the type contracts shared across api, web and workers.
 */

/** Ordered lifecycle stages an episode moves through during production. */
export const EPISODE_STATUSES = [
  'draft',
  'scripting',
  'rendering',
  'review',
  'published',
] as const;

/** A single valid episode status. */
export type EpisodeStatus = (typeof EPISODE_STATUSES)[number];

/** Lightweight summary of an episode, suitable for list views and APIs. */
export interface EpisodeSummary {
  /** Stable unique identifier. */
  id: string;
  /** Human-readable episode title. */
  title: string;
  /** Current lifecycle status. */
  status: EpisodeStatus;
  /** ISO-8601 timestamp of when the episode was created. */
  createdAt: string;
}
