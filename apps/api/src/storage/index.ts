import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  EPISODE_STAGES,
  STAGE_EXPECTED_FILES,
  type CreateEpisodeInput,
  type EpisodeDetail,
  type EpisodeStage,
  type EpisodeStageState,
  type EpisodeStageStatus,
  type EpisodeSummary,
} from '@creator-ai-studio/shared';

/**
 * Per-episode stage directories. `00-control` holds the control files; every
 * other stage gets a `.gitkeep` so the (otherwise empty) folder is preserved.
 */
export const EPISODE_STAGE_DIRECTORIES = [
  '00-control',
  '01-research',
  '02-script',
  '03-storyboard',
  '04-assets',
  '05-audio',
  '06-video',
  '07-thumbnail',
  '08-seo',
  '09-shorts',
  '10-publish',
  '11-analytics',
  '12-review',
] as const;

const DEFAULT_STORAGE_DIR = 'episodes';

/** Persisted shape of a stage entry in `00-control/stages.json`. */
interface PersistedStage {
  stage: EpisodeStage;
  status: EpisodeStageStatus;
}

/** Resolve the local storage root from LOCAL_STORAGE_PATH or the default. */
export function resolveStoragePath(): string {
  return path.resolve(process.env.LOCAL_STORAGE_PATH ?? DEFAULT_STORAGE_DIR);
}

/** Convert a title into a URL/filesystem-friendly slug. */
export function slugify(title: string): string {
  const slug = title
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

  return slug || 'episode';
}

/** Initial status of a stage: planning starts completed, everything else pending. */
function defaultStageStatus(stage: EpisodeStage): EpisodeStageStatus {
  return stage === 'planning' ? 'completed' : 'pending';
}

/** Build the initial persisted stage list for a brand-new episode. */
function createInitialStages(): PersistedStage[] {
  return EPISODE_STAGES.map((stage) => ({
    stage,
    status: defaultStageStatus(stage),
  }));
}

/**
 * Local filesystem storage for episodes.
 *
 * No external services are used; everything is read from and written to the
 * configured base directory.
 */
export class EpisodeStorage {
  constructor(private readonly basePath: string) {}

  /** Create a new episode and its full stage folder structure on disk. */
  async createEpisode(input: CreateEpisodeInput): Promise<EpisodeSummary> {
    const id = randomUUID();
    const slug = slugify(input.title);
    const now = new Date().toISOString();

    const episode: EpisodeSummary = {
      id,
      slug,
      title: input.title,
      status: 'draft',
      createdAt: now,
      updatedAt: now,
    };

    const episodeDir = path.join(this.basePath, `${id}-${slug}`);

    for (const stage of EPISODE_STAGE_DIRECTORIES) {
      await mkdir(path.join(episodeDir, stage), { recursive: true });
    }

    await writeFile(
      path.join(episodeDir, 'episode.json'),
      `${JSON.stringify(episode, null, 2)}\n`,
      'utf8',
    );

    await writeFile(
      path.join(episodeDir, '00-control', 'status.json'),
      `${JSON.stringify({ episodeId: id, status: episode.status, updatedAt: now }, null, 2)}\n`,
      'utf8',
    );

    await writeFile(
      path.join(episodeDir, '00-control', 'stages.json'),
      `${JSON.stringify(createInitialStages(), null, 2)}\n`,
      'utf8',
    );

    for (const stage of EPISODE_STAGE_DIRECTORIES) {
      if (stage === '00-control') {
        continue;
      }
      await writeFile(path.join(episodeDir, stage, '.gitkeep'), '', 'utf8');
    }

    return episode;
  }

  /** List every stored episode, sorted by creation time (oldest first). */
  async listEpisodes(): Promise<EpisodeSummary[]> {
    if (!existsSync(this.basePath)) {
      return [];
    }

    const entries = await readdir(this.basePath, { withFileTypes: true });
    const episodes: EpisodeSummary[] = [];

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const episodeFile = path.join(this.basePath, entry.name, 'episode.json');
      if (!existsSync(episodeFile)) {
        continue;
      }

      const raw = await readFile(episodeFile, 'utf8');
      episodes.push(JSON.parse(raw) as EpisodeSummary);
    }

    episodes.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return episodes;
  }

  /** Read full detail for one episode, or null if it does not exist. */
  async getEpisode(id: string): Promise<EpisodeDetail | null> {
    if (!existsSync(this.basePath)) {
      return null;
    }

    const entries = await readdir(this.basePath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const episodeDir = path.join(this.basePath, entry.name);
      const episodeFile = path.join(episodeDir, 'episode.json');
      if (!existsSync(episodeFile)) {
        continue;
      }

      const summary = JSON.parse(
        await readFile(episodeFile, 'utf8'),
      ) as EpisodeSummary;
      if (summary.id !== id) {
        continue;
      }

      return {
        ...summary,
        workspacePath: entry.name,
        stages: await this.readStages(episodeDir),
      };
    }

    return null;
  }

  /** Read the stage states for an episode, enriched with expected files. */
  private async readStages(episodeDir: string): Promise<EpisodeStageState[]> {
    const stagesFile = path.join(episodeDir, '00-control', 'stages.json');
    const statusByStage = new Map<EpisodeStage, EpisodeStageStatus>();

    if (existsSync(stagesFile)) {
      const parsed = JSON.parse(
        await readFile(stagesFile, 'utf8'),
      ) as PersistedStage[];
      for (const item of parsed) {
        statusByStage.set(item.stage, item.status);
      }
    }

    return EPISODE_STAGES.map((stage) => {
      const state: EpisodeStageState = {
        stage,
        status: statusByStage.get(stage) ?? defaultStageStatus(stage),
      };
      const expectedFiles = STAGE_EXPECTED_FILES[stage];
      if (expectedFiles) {
        state.expectedFiles = expectedFiles;
      }
      return state;
    });
  }
}
