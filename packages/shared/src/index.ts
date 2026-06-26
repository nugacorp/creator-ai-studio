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

/** A single storyboard scene within an episode. */
export interface Scene {
  id: string;
  text: string;
  imageUrl: string;
  voiceoverPrompt: string;
  musicTrack: string;
  duration: number;
  transition: string;
}

/** Rich content stored alongside episode metadata. */
export interface EpisodeContent {
  series: string;
  channelId?: string;
  script: string;
  outline: string[];
  scenes: Scene[];
  seoTitles: string[];
  seoDescription: string;
  seoTags: string[];
  thumbnailUrl?: string;
  audioUrl?: string;
  scheduledAt?: string;
  duration: string;
}

/** Default empty content for a new episode. */
export function createDefaultContent(): EpisodeContent {
  return {
    series: 'Reflexiones',
    script: '',
    outline: [],
    scenes: [],
    seoTitles: [],
    seoDescription: '',
    seoTags: [],
    duration: '00:00',
  };
}

/** Full episode detail: summary metadata plus workspace and stage state. */
export interface EpisodeDetail extends EpisodeSummary {
  /** Path to the episode workspace, relative to the storage root. */
  workspacePath: string;
  /** Production stages with their current status. */
  stages: EpisodeStageState[];
  /** Editable workspace content (script, scenes, SEO, etc.). */
  content: EpisodeContent;
}

/** Partial update for episode metadata and content. */
export interface UpdateEpisodeInput {
  title?: string;
  status?: EpisodeStatus;
  content?: Partial<EpisodeContent>;
}

/** Input accepted when updating a single stage's status. */
export interface UpdateStageInput {
  status: EpisodeStageStatus;
}

/** UI Kanban column labels used by the dashboard. */
export const PROJECT_STATUSES = [
  'Ideas',
  'Investigación',
  'Guion',
  'Narración IA',
  'Edición',
  'Miniatura',
  'Programado',
  'Publicado',
] as const;

export type ProjectStatus = (typeof PROJECT_STATUSES)[number];

/** Map UI Kanban status to backend episode lifecycle status. */
export const PROJECT_TO_EPISODE_STATUS: Record<ProjectStatus, EpisodeStatus> = {
  Ideas: 'draft',
  Investigación: 'draft',
  Guion: 'scripting',
  'Narración IA': 'scripting',
  Edición: 'rendering',
  Miniatura: 'rendering',
  Programado: 'review',
  Publicado: 'published',
};

/** Map backend episode lifecycle status to UI Kanban status. */
export const EPISODE_TO_PROJECT_STATUS: Record<EpisodeStatus, ProjectStatus> = {
  draft: 'Ideas',
  scripting: 'Guion',
  rendering: 'Edición',
  review: 'Programado',
  published: 'Publicado',
};

/** Progress percentage for each episode lifecycle status. */
export const EPISODE_STATUS_PROGRESS: Record<EpisodeStatus, number> = {
  draft: 10,
  scripting: 45,
  rendering: 80,
  review: 95,
  published: 100,
};

/** Type guard for UI project status values. */
export function isProjectStatus(value: unknown): value is ProjectStatus {
  return (
    typeof value === 'string' &&
    (PROJECT_STATUSES as readonly string[]).includes(value)
  );
}

/** Type guard for episode lifecycle status. */
export function isEpisodeStatus(value: unknown): value is EpisodeStatus {
  return (
    typeof value === 'string' &&
    (EPISODE_STATUSES as readonly string[]).includes(value)
  );
}

/** Job types processed by the production worker. */
export const JOB_TYPES = ['script', 'tts', 'render', 'thumbnail', 'publish'] as const;
export type JobType = (typeof JOB_TYPES)[number];

/** Job lifecycle statuses. */
export const JOB_STATUSES = ['pending', 'active', 'completed', 'failed'] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

/** A background production job. */
export interface ProductionJob {
  id: string;
  episodeId: string;
  type: JobType;
  status: JobStatus;
  progress: number;
  result?: Record<string, unknown>;
  error?: string;
  createdAt: string;
  updatedAt: string;
}

/** Input to enqueue a new production job. */
export interface CreateJobInput {
  type: JobType;
  payload?: Record<string, unknown>;
}

/** Global application settings persisted by the API. */
export interface AppSettings {
  ttsSampleRate: string;
  ttsAccent: string;
  aiProviderDefault: string;
}

export function isJobType(value: unknown): value is JobType {
  return typeof value === 'string' && (JOB_TYPES as readonly string[]).includes(value);
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
