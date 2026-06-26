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
  /** URL-friendly identifier derived from the title. */
  slug: string;
  /** Human-readable episode title. */
  title: string;
  /** Current lifecycle status. */
  status: EpisodeStatus;
  /** ISO-8601 timestamp of when the episode was created. */
  createdAt: string;
  /** ISO-8601 timestamp of the last update. */
  updatedAt: string;
}

/** Input accepted when creating a new episode. */
export interface CreateEpisodeInput {
  /** Human-readable episode title. The slug is derived from it. */
  title: string;
}

/** Official production stages, in execution order. */
export const EPISODE_STAGES = [
  'planning',
  'research',
  'script',
  'doctrine_review',
  'editorial_review',
  'storyboard',
  'assets',
  'audio',
  'video',
  'thumbnail',
  'seo',
  'shorts',
  'final_review',
  'publishing',
  'analytics',
] as const;

/** A single production stage. */
export type EpisodeStage = (typeof EPISODE_STAGES)[number];

/** Allowed statuses for a production stage. */
export const EPISODE_STAGE_STATUSES = [
  'pending',
  'in_progress',
  'completed',
  'blocked',
] as const;

/** A single production stage status. */
export type EpisodeStageStatus = (typeof EPISODE_STAGE_STATUSES)[number];

/**
 * Files each stage is expected to eventually produce, relative to the episode
 * workspace. Descriptive only — no files are created from this map.
 */
export const STAGE_EXPECTED_FILES: Partial<Record<EpisodeStage, string[]>> = {
  research: ['01-research/notes.md'],
  script: ['02-script/script.md'],
  storyboard: ['03-storyboard/storyboard.md'],
  audio: ['05-audio/voiceover.mp3'],
  video: ['06-video/episode.mp4'],
  thumbnail: ['07-thumbnail/thumbnail.png'],
  seo: ['08-seo/metadata.json'],
};

/** State of a single production stage. */
export interface EpisodeStageState {
  /** The stage this state refers to. */
  stage: EpisodeStage;
  /** Current status of the stage. */
  status: EpisodeStageStatus;
  /** Files this stage is expected to produce, if any. */
  expectedFiles?: string[];
}

/** Full episode detail: summary metadata plus workspace and stage state. */
export interface EpisodeDetail extends EpisodeSummary {
  /** Path to the episode workspace, relative to the storage root. */
  workspacePath: string;
  /** Production stages with their current status. */
  stages: EpisodeStageState[];
}

/** Input accepted when updating a single stage's status. */
export interface UpdateStageInput {
  status: EpisodeStageStatus;
}

/** Type guard: is the given value an official production stage? */
export function isEpisodeStage(value: unknown): value is EpisodeStage {
  return (
    typeof value === 'string' &&
    (EPISODE_STAGES as readonly string[]).includes(value)
  );
}

/** Type guard: is the given value an allowed stage status? */
export function isEpisodeStageStatus(value: unknown): value is EpisodeStageStatus {
  return (
    typeof value === 'string' &&
    (EPISODE_STAGE_STATUSES as readonly string[]).includes(value)
  );
}

/**
 * Simple manual transition rules for the MVP: a stage may move to any other
 * allowed status, but moving to its current status is a no-op and rejected.
 */
export const ALLOWED_STAGE_TRANSITIONS: Record<
  EpisodeStageStatus,
  EpisodeStageStatus[]
> = {
  pending: ['in_progress', 'completed', 'blocked'],
  in_progress: ['completed', 'blocked', 'pending'],
  completed: ['in_progress', 'blocked', 'pending'],
  blocked: ['pending', 'in_progress', 'completed'],
};

/** Whether a manual stage transition from one status to another is allowed. */
export function canTransitionStage(
  from: EpisodeStageStatus,
  to: EpisodeStageStatus,
): boolean {
  return ALLOWED_STAGE_TRANSITIONS[from].includes(to);
}
