import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import type {
  CreateEpisodeInput,
  EpisodeSummary,
} from '@creator-ai-studio/shared';

/**
 * Per-episode stage directories. `00-control` holds the status file; every
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
}
