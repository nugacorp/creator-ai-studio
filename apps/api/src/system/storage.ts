import { statfs } from 'node:fs';
import { promisify } from 'node:util';
import type { StorageStats } from '@creator-ai-studio/shared';
import { isArchiveConfigured } from '../archive/drive.js';
import { isPiperAvailable } from '../integrations/piper.js';
import { getDirSizeBytes } from '../media/render.js';
import { EpisodeStorage, resolveStoragePath } from '../storage/index.js';
import { getSettings } from '../settings/store.js';

const statfsAsync = promisify(statfs);

async function isFfmpegOnPath(): Promise<boolean> {
  try {
    const { execFile } = await import('node:child_process');
    const { promisify } = await import('node:util');
    await promisify(execFile)('ffmpeg', ['-version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function getStorageStats(storage: EpisodeStorage): Promise<StorageStats> {
  const episodesPath = resolveStoragePath();
  const settings = await getSettings();
  const episodes = await storage.listEpisodes();

  const activeEpisodeCount = episodes.filter(e => e.archiveStatus !== 'archived').length;
  const archivedEpisodeCount = episodes.filter(e => e.archiveStatus === 'archived').length;
  const episodesBytes = await getDirSizeBytes(episodesPath);

  let totalBytes = 0;
  let freeBytes = 0;
  try {
    const fsStat = await statfsAsync(episodesPath);
    totalBytes = Number(fsStat.blocks) * Number(fsStat.bsize);
    freeBytes = Number(fsStat.bavail) * Number(fsStat.bsize);
  } catch {
    totalBytes = 0;
    freeBytes = 0;
  }

  const usedBytes = totalBytes > 0 ? totalBytes - freeBytes : episodesBytes;
  const thresholdBytes = settings.diskWarningThresholdGb * 1024 ** 3;

  return {
    episodesPath,
    totalBytes,
    usedBytes,
    freeBytes,
    episodesBytes,
    activeEpisodeCount,
    archivedEpisodeCount,
    maxActiveEpisodes: settings.maxActiveEpisodes,
    diskWarning: episodesBytes >= thresholdBytes,
    archiveConfigured: isArchiveConfigured(),
    ffmpegAvailable: await isFfmpegOnPath(),
    piperAvailable: isPiperAvailable(),
  };
}
