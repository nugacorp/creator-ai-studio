import { execFile } from 'node:child_process';
import { createWriteStream } from 'node:fs';
import { mkdir, rm, stat } from 'node:fs/promises';
import path from 'node:path';
import { pipeline } from 'node:stream/promises';
import type { Readable } from 'node:stream';
import { promisify } from 'node:util';
import process from 'node:process';
import type { AssetKind } from '@creator-ai-studio/shared';
import { resolveDataPath } from '../storage/index.js';

const execFileAsync = promisify(execFile);

/**
 * File layout for the DAM (AD-1: bytes live on the VPS volume, not in Supabase
 * Storage). One directory per asset version so a re-upload never destroys the
 * previous file:
 *
 *   /data/assets/<churchId>/<yyyy>/<mm>/<assetId>/v<n>/<filename>
 *   /data/assets/<churchId>/<yyyy>/<mm>/<assetId>/thumb.jpg
 *
 * Everything persisted in Postgres is *relative* to the data root, so moving
 * the volume does not invalidate the index.
 */

/** Sermons in ProRes get big; 5 GB is a deliberate, configurable ceiling. */
export const MAX_ASSET_BYTES = Number(process.env.CAS_MAX_ASSET_BYTES ?? 5 * 1024 * 1024 * 1024);

export function assetsRoot(): string {
  return path.join(resolveDataPath(), 'assets', 'church');
}

/** Strip anything that could escape the target directory or confuse a shell. */
export function safeFileName(name: string): string {
  const base = path.basename(name).replace(/[^a-zA-Z0-9._-]+/g, '_');
  const trimmed = base.replace(/^\.+/, '').slice(0, 160);
  return trimmed || 'archivo.bin';
}

export function assetDirRelative(churchId: string, assetId: string, createdAt: Date): string {
  const yyyy = String(createdAt.getUTCFullYear());
  const mm = String(createdAt.getUTCMonth() + 1).padStart(2, '0');
  return path.posix.join('assets', 'church', churchId, yyyy, mm, assetId);
}

/** Resolve a stored relative path to disk, refusing anything outside the root. */
export function resolveAssetPath(relativePath: string): string {
  const dataRoot = resolveDataPath();
  const full = path.resolve(dataRoot, relativePath);
  const allowed = path.resolve(dataRoot, 'assets');
  if (full !== allowed && !full.startsWith(allowed + path.sep)) {
    throw new Error('ruta de archivo fuera del almacén de activos');
  }
  return full;
}

export interface StoredFile {
  /** Path relative to the data root, as persisted in `church_assets`. */
  relativePath: string;
  sizeBytes: number;
  fileName: string;
}

export class AssetTooLargeError extends Error {
  constructor(limitBytes: number) {
    super(`El archivo supera el límite de ${Math.round(limitBytes / (1024 * 1024))} MB`);
    this.name = 'AssetTooLargeError';
  }
}

/**
 * Stream an upload straight to disk. Never buffers the whole file — a 2 GB
 * sermon must not become a 2 GB Buffer in the API process.
 */
export async function storeAssetStream(options: {
  churchId: string;
  assetId: string;
  version: number;
  fileName: string;
  source: Readable;
  createdAt?: Date;
  maxBytes?: number;
}): Promise<StoredFile> {
  const {
    churchId,
    assetId,
    version,
    source,
    createdAt = new Date(),
    maxBytes = MAX_ASSET_BYTES,
  } = options;

  const fileName = safeFileName(options.fileName);
  const dirRelative = path.posix.join(assetDirRelative(churchId, assetId, createdAt), `v${version}`);
  const dirAbsolute = resolveAssetPath(dirRelative);
  await mkdir(dirAbsolute, { recursive: true });

  const targetAbsolute = path.join(dirAbsolute, fileName);
  let written = 0;
  let aborted = false;

  source.on('data', (chunk: Buffer) => {
    written += chunk.length;
    if (written > maxBytes && !aborted) {
      aborted = true;
      source.destroy(new AssetTooLargeError(maxBytes));
    }
  });

  try {
    await pipeline(source, createWriteStream(targetAbsolute));
  } catch (error) {
    await rm(targetAbsolute, { force: true }).catch(() => undefined);
    throw error;
  }

  const stats = await stat(targetAbsolute);
  return {
    relativePath: path.posix.join(dirRelative, fileName),
    sizeBytes: stats.size,
    fileName,
  };
}

/** Remove every stored byte of an asset (all versions and its thumbnail). */
export async function deleteAssetFiles(
  churchId: string,
  assetId: string,
  createdAt: Date,
): Promise<void> {
  const dir = resolveAssetPath(assetDirRelative(churchId, assetId, createdAt));
  await rm(dir, { recursive: true, force: true });
}

export async function checkFfmpegAvailable(): Promise<boolean> {
  try {
    await execFileAsync('ffmpeg', ['-version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

/** Asset kinds we can render a preview image for. */
export function supportsThumbnail(kind: AssetKind): boolean {
  return kind === 'video' || kind === 'image';
}

/**
 * Render a 640px-wide JPEG preview next to the asset.
 * Videos are sampled one second in — frame 0 is often black.
 */
export async function generateAssetThumbnail(options: {
  churchId: string;
  assetId: string;
  kind: AssetKind;
  sourceRelativePath: string;
  createdAt: Date;
}): Promise<string | null> {
  const { churchId, assetId, kind, sourceRelativePath, createdAt } = options;
  if (!supportsThumbnail(kind)) return null;

  const source = resolveAssetPath(sourceRelativePath);
  const dirRelative = assetDirRelative(churchId, assetId, createdAt);
  const thumbRelative = path.posix.join(dirRelative, 'thumb.jpg');
  const thumbAbsolute = resolveAssetPath(thumbRelative);
  await mkdir(path.dirname(thumbAbsolute), { recursive: true });

  const args =
    kind === 'video'
      ? ['-y', '-ss', '00:00:01', '-i', source, '-frames:v', '1', '-vf', 'scale=640:-2', thumbAbsolute]
      : ['-y', '-i', source, '-vf', 'scale=640:-2', thumbAbsolute];

  try {
    await execFileAsync('ffmpeg', args, { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 });
  } catch {
    if (kind !== 'video') return null;
    // Clip shorter than a second: retry from the very first frame.
    try {
      await execFileAsync(
        'ffmpeg',
        ['-y', '-i', source, '-frames:v', '1', '-vf', 'scale=640:-2', thumbAbsolute],
        { timeout: 120_000, maxBuffer: 8 * 1024 * 1024 },
      );
    } catch {
      return null;
    }
  }

  try {
    await stat(thumbAbsolute);
    return thumbRelative;
  } catch {
    return null;
  }
}

/** Guess an asset kind from a MIME type, so the UI can default the field. */
export function kindFromMimeType(mimeType: string | undefined): AssetKind {
  const mime = (mimeType ?? '').toLowerCase();
  if (mime.startsWith('video/')) return 'video';
  if (mime.startsWith('audio/')) return 'audio';
  if (mime.startsWith('image/')) return 'image';
  return 'document';
}
