import { rm } from 'node:fs/promises';
import path from 'node:path';
import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import type { ArchiveResult } from '@creator-ai-studio/shared';

const execFileAsync = promisify(execFile);

export function isArchiveConfigured(): boolean {
  return Boolean(process.env.RCLONE_REMOTE?.trim());
}

function remoteBase(): string {
  return process.env.RCLONE_REMOTE!.replace(/\/$/, '');
}

/** Upload episode workspace to Google Drive (or any rclone remote) and remove local copy. */
export async function archiveEpisodeWorkspace(
  storageRoot: string,
  workspacePath: string,
): Promise<ArchiveResult> {
  if (!isArchiveConfigured()) {
    return {
      ok: false,
      message: 'Configura RCLONE_REMOTE en Coolify (ej. gdrive:CAS/archive)',
    };
  }

  const localPath = path.join(storageRoot, workspacePath);
  const remotePath = `${remoteBase()}/${workspacePath}`;

  try {
    await execFileAsync(
      'rclone',
      ['copy', localPath, remotePath, '--create-empty-src-dirs', '-v'],
      {
        timeout: 1_800_000,
        env: {
          ...process.env,
          RCLONE_CONFIG: process.env.RCLONE_CONFIG ?? '/config/rclone/rclone.conf',
        },
      },
    );

    await execFileAsync(
      'rclone',
      ['ls', remotePath],
      {
        timeout: 60_000,
        env: {
          ...process.env,
          RCLONE_CONFIG: process.env.RCLONE_CONFIG ?? '/config/rclone/rclone.conf',
        },
      },
    );

    await rm(localPath, { recursive: true, force: true });

    return {
      ok: true,
      drivePath: remotePath,
      message: `Episodio archivado en ${remotePath}. Espacio local liberado.`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al archivar';
    return { ok: false, message };
  }
}

/** Restore an archived episode from cloud storage back to VPS (temporary edit/review). */
export async function restoreEpisodeWorkspace(
  storageRoot: string,
  workspacePath: string,
): Promise<ArchiveResult> {
  if (!isArchiveConfigured()) {
    return { ok: false, message: 'RCLONE_REMOTE no configurado' };
  }

  const localPath = path.join(storageRoot, workspacePath);
  const remotePath = `${remoteBase()}/${workspacePath}`;

  try {
    await execFileAsync(
      'rclone',
      ['copy', remotePath, localPath, '--create-empty-src-dirs'],
      {
        timeout: 1_800_000,
        env: {
          ...process.env,
          RCLONE_CONFIG: process.env.RCLONE_CONFIG ?? '/config/rclone/rclone.conf',
        },
      },
    );
    return { ok: true, drivePath: remotePath, message: 'Episodio restaurado desde Drive' };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error al restaurar';
    return { ok: false, message };
  }
}
