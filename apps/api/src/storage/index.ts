import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import {
  EPISODE_STAGES,
  STAGE_EXPECTED_FILES,
  createDefaultContent,
  type CreateEpisodeInput,
  type EpisodeContent,
  type EpisodeDetail,
  type EpisodeStage,
  type EpisodeStageState,
  type EpisodeStageStatus,
  type EpisodeSummary,
  type UpdateEpisodeInput,
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
  '06-subtitles',
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

/** A located episode on disk. */
interface LocatedEpisode {
  /** Absolute path to the episode directory. */
  dir: string;
  /** Directory name, relative to the storage root. */
  name: string;
  /** Parsed episode summary. */
  summary: EpisodeSummary;
}

/** Resolve the local storage root from LOCAL_STORAGE_PATH or the default. */
export function resolveStoragePath(): string {
  return path.resolve(process.env.LOCAL_STORAGE_PATH ?? DEFAULT_STORAGE_DIR);
}

/**
 * Persistent data root (settings, secrets, jobs). Defaults to the parent of the
 * episodes directory when LOCAL_STORAGE_PATH ends with `/episodes` (e.g.
 * `/data/episodes` → `/data`). Override with CAS_DATA_PATH on the server.
 */
export function resolveDataPath(): string {
  const configured = process.env.CAS_DATA_PATH?.trim();
  if (configured) {
    return path.resolve(configured);
  }
  const storage = resolveStoragePath();
  if (path.basename(storage) === 'episodes') {
    return path.dirname(storage);
  }
  return storage;
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
  async createEpisode(input: CreateEpisodeInput, userId?: string): Promise<EpisodeSummary> {
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
      archiveStatus: 'local',
      ...(userId ? { userId } : {}),
      ...(input.channelId ? { channelId: input.channelId } : {}),
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

    await this.writeControlFiles(episodeDir, episode, createInitialStages());
    const content = createDefaultContent();
    if (input.channelId) {
      content.channelId = input.channelId;
    }
    await this.writeContent(episodeDir, content);

    for (const stage of EPISODE_STAGE_DIRECTORIES) {
      if (stage === '00-control') {
        continue;
      }
      await writeFile(path.join(episodeDir, stage, '.gitkeep'), '', 'utf8');
    }

    return episode;
  }

  /** Count episodes still stored on local disk (not archived). */
  async countActiveLocalEpisodes(userId?: string): Promise<number> {
    const onDisk = await this.listLocalEpisodes();
    const active = onDisk.filter(e => e.archiveStatus !== 'archived');
    if (!userId) return active.length;
    return active.filter(e => !e.userId || e.userId === userId).length;
  }

  /** Absolute path to an episode workspace directory. */
  async getEpisodeDirectory(id: string): Promise<string | null> {
    const located = await this.findEpisode(id);
    return located?.dir ?? null;
  }

  /** Mark episode as archived in the index (workspace folder may already be removed). */
  async markArchived(
    summary: EpisodeSummary,
    drivePath: string,
    localWorkspace: string,
  ): Promise<EpisodeSummary> {
    const archived: EpisodeSummary = {
      ...summary,
      archiveStatus: 'archived',
      archivedAt: new Date().toISOString(),
      drivePath,
      localWorkspace,
      updatedAt: new Date().toISOString(),
    };
    const index = await this.readArchivedIndex();
    const next = index.filter(e => e.id !== summary.id);
    next.push(archived);
    await this.writeArchivedIndex(next);
    return archived;
  }

  /** List every stored episode, sorted by creation time (oldest first). */
  async listEpisodes(userId?: string, channelId?: string): Promise<EpisodeSummary[]> {
    const local = await this.listLocalEpisodes();
    const archived = await this.readArchivedIndex();
    const localIds = new Set(local.map(e => e.id));
    let merged = [...local, ...archived.filter(e => !localIds.has(e.id))];
    merged.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    if (userId) {
      merged = merged.filter(e => !e.userId || e.userId === userId);
    }
    if (channelId) {
      merged = merged.filter(e => e.channelId === channelId);
    }
    return merged;
  }

  /** Episodes with workspace folders on disk. */
  async listLocalEpisodes(): Promise<EpisodeSummary[]> {
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
      const summary = JSON.parse(raw) as EpisodeSummary;
      episodes.push({ ...summary, archiveStatus: summary.archiveStatus ?? 'local' });
    }

    episodes.sort((a, b) => a.createdAt.localeCompare(b.createdAt));
    return episodes;
  }

  private archivedIndexPath(): string {
    return path.join(this.basePath, '..', 'archived-episodes.json');
  }

  private async readArchivedIndex(): Promise<EpisodeSummary[]> {
    const file = this.archivedIndexPath();
    if (!existsSync(file)) return [];
    try {
      return JSON.parse(await readFile(file, 'utf8')) as EpisodeSummary[];
    } catch {
      return [];
    }
  }

  private async writeArchivedIndex(episodes: EpisodeSummary[]): Promise<void> {
    const file = this.archivedIndexPath();
    await mkdir(path.dirname(file), { recursive: true });
    await writeFile(file, `${JSON.stringify(episodes, null, 2)}\n`, 'utf8');
  }

  async removeFromArchivedIndex(id: string): Promise<void> {
    const index = await this.readArchivedIndex();
    await this.writeArchivedIndex(index.filter(e => e.id !== id));
  }

  /** Permanently delete an episode workspace and remove archived index entries. */
  async deleteEpisode(id: string): Promise<boolean> {
    const located = await this.findEpisode(id);
    if (located !== null) {
      await rm(located.dir, { recursive: true, force: true });
      return true;
    }

    const archived = (await this.readArchivedIndex()).some(e => e.id === id);
    if (archived) {
      await this.removeFromArchivedIndex(id);
      return true;
    }

    return false;
  }

  /** Read full detail for one episode, or null if it does not exist. */
  async getEpisode(id: string): Promise<EpisodeDetail | null> {
    const located = await this.findEpisode(id);
    if (located !== null) {
      return {
        ...located.summary,
        workspacePath: located.name,
        stages: await this.readStages(located.dir),
        content: await this.readContent(located.dir),
      };
    }

    const archived = (await this.readArchivedIndex()).find(e => e.id === id);
    if (!archived) return null;

    return {
      ...archived,
      workspacePath: archived.drivePath ?? archived.slug,
      stages: EPISODE_STAGES.map(stage => ({
        stage,
        status: 'completed' as const,
        expectedFiles: STAGE_EXPECTED_FILES[stage],
      })),
      content: createDefaultContent(),
    };
  }

  /** Update episode metadata and/or content. Returns null if not found. */
  async updateEpisode(
    id: string,
    input: UpdateEpisodeInput,
  ): Promise<EpisodeDetail | null> {
    const located = await this.findEpisode(id);
    if (located === null) {
      return null;
    }

    const now = new Date().toISOString();
    const summary: EpisodeSummary = {
      ...located.summary,
      ...(input.title !== undefined ? { title: input.title.trim() } : {}),
      ...(input.status !== undefined ? { status: input.status } : {}),
      updatedAt: now,
    };

    await writeFile(
      path.join(located.dir, 'episode.json'),
      `${JSON.stringify(summary, null, 2)}\n`,
      'utf8',
    );

    if (input.content) {
      const current = await this.readContent(located.dir);
      const merged = { ...current, ...input.content };
      if (merged.channelId !== undefined && merged.channelId !== summary.channelId) {
        summary.channelId = merged.channelId;
        await writeFile(
          path.join(located.dir, 'episode.json'),
          `${JSON.stringify(summary, null, 2)}\n`,
          'utf8',
        );
      }
      await this.writeContent(located.dir, merged);
    }

    const stages = await this.readStages(located.dir);
    const persisted = stages.map((s) => ({ stage: s.stage, status: s.status }));
    await this.writeControlFiles(located.dir, summary, persisted);

    return {
      ...summary,
      workspacePath: located.name,
      stages,
      content: await this.readContent(located.dir),
    };
  }

  /**
   * Update a single stage's status and persist it. Returns the updated detail,
   * or null if the episode does not exist. Does not enforce transition rules —
   * that validation belongs to the caller.
   */
  async setStageStatus(
    id: string,
    stage: EpisodeStage,
    status: EpisodeStageStatus,
  ): Promise<EpisodeDetail | null> {
    const located = await this.findEpisode(id);
    if (located === null) {
      return null;
    }

    const statusByStage = await this.readPersistedStatus(located.dir);
    statusByStage.set(stage, status);

    const persisted: PersistedStage[] = EPISODE_STAGES.map((current) => ({
      stage: current,
      status: statusByStage.get(current) ?? defaultStageStatus(current),
    }));

    const summary: EpisodeSummary = {
      ...located.summary,
      updatedAt: new Date().toISOString(),
    };

    await writeFile(
      path.join(located.dir, 'episode.json'),
      `${JSON.stringify(summary, null, 2)}\n`,
      'utf8',
    );
    await this.writeControlFiles(located.dir, summary, persisted);

    return {
      ...summary,
      workspacePath: located.name,
      stages: await this.readStages(located.dir),
      content: await this.readContent(located.dir),
    };
  }

  /** Read persisted content for an episode. */
  async readContent(episodeDir: string): Promise<EpisodeContent> {
    const contentFile = path.join(episodeDir, '00-control', 'content.json');
    if (!existsSync(contentFile)) {
      return createDefaultContent();
    }
    const parsed = JSON.parse(await readFile(contentFile, 'utf8')) as EpisodeContent;
    return { ...createDefaultContent(), ...parsed };
  }

  /** Write content to disk and stage-specific files. */
  private async writeContent(episodeDir: string, content: EpisodeContent): Promise<void> {
    await writeFile(
      path.join(episodeDir, '00-control', 'content.json'),
      `${JSON.stringify(content, null, 2)}\n`,
      'utf8',
    );

    if (content.script) {
      await writeFile(
        path.join(episodeDir, '02-script', 'script.md'),
        content.script,
        'utf8',
      );
    }

    if (content.scenes.length > 0) {
      await writeFile(
        path.join(episodeDir, '03-storyboard', 'scenes.json'),
        `${JSON.stringify(content.scenes, null, 2)}\n`,
        'utf8',
      );
    }

    const seoMeta = {
      titles: content.seoTitles,
      description: content.seoDescription,
      tags: content.seoTags,
    };
    await writeFile(
      path.join(episodeDir, '08-seo', 'metadata.json'),
      `${JSON.stringify(seoMeta, null, 2)}\n`,
      'utf8',
    );
  }

  /** Locate an episode directory by id. */
  private async findEpisode(id: string): Promise<LocatedEpisode | null> {
    if (!existsSync(this.basePath)) {
      return null;
    }

    const entries = await readdir(this.basePath, { withFileTypes: true });

    for (const entry of entries) {
      if (!entry.isDirectory()) {
        continue;
      }

      const dir = path.join(this.basePath, entry.name);
      const episodeFile = path.join(dir, 'episode.json');
      if (!existsSync(episodeFile)) {
        continue;
      }

      const summary = JSON.parse(
        await readFile(episodeFile, 'utf8'),
      ) as EpisodeSummary;
      if (summary.id === id) {
        return { dir, name: entry.name, summary };
      }
    }

    return null;
  }

  /** Write `00-control/status.json` and `00-control/stages.json`. */
  private async writeControlFiles(
    episodeDir: string,
    summary: EpisodeSummary,
    stages: PersistedStage[],
  ): Promise<void> {
    await writeFile(
      path.join(episodeDir, '00-control', 'status.json'),
      `${JSON.stringify({ episodeId: summary.id, status: summary.status, updatedAt: summary.updatedAt }, null, 2)}\n`,
      'utf8',
    );
    await writeFile(
      path.join(episodeDir, '00-control', 'stages.json'),
      `${JSON.stringify(stages, null, 2)}\n`,
      'utf8',
    );
  }

  /** Read the persisted stage->status map for an episode. */
  private async readPersistedStatus(
    episodeDir: string,
  ): Promise<Map<EpisodeStage, EpisodeStageStatus>> {
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

    return statusByStage;
  }

  /** Read the stage states for an episode, enriched with expected files. */
  private async readStages(episodeDir: string): Promise<EpisodeStageState[]> {
    const statusByStage = await this.readPersistedStatus(episodeDir);

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
