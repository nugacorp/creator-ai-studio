import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  isDigitalAssetType,
  isDigitalMinistry,
  type CreateDigitalAssetInput,
  type DigitalAssetRecord,
  type UpdateDigitalAssetInput,
} from '@creator-ai-studio/shared';
import { resolveDataPath } from '../storage/index.js';

function assetsPath(): string {
  return path.join(resolveDataPath(), 'assets', 'digital-assets.json');
}

function normalizeList(values: unknown, maxItems: number): string[] {
  if (!Array.isArray(values)) return [];
  const deduped = new Set<string>();
  for (const value of values) {
    if (typeof value !== 'string') continue;
    const trimmed = value.trim();
    if (!trimmed) continue;
    deduped.add(trimmed);
    if (deduped.size >= maxItems) break;
  }
  return [...deduped];
}

async function readAssets(): Promise<DigitalAssetRecord[]> {
  const file = assetsPath();
  if (!existsSync(file)) return [];
  try {
    const raw = await readFile(file, 'utf8');
    const parsed = JSON.parse(raw) as DigitalAssetRecord[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function writeAssets(entries: DigitalAssetRecord[]): Promise<void> {
  const file = assetsPath();
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, `${JSON.stringify(entries, null, 2)}\n`, 'utf8');
  await rename(tmp, file);
}

function buildRecord(
  input: CreateDigitalAssetInput,
  userId?: string,
): DigitalAssetRecord {
  const now = new Date().toISOString();
  return {
    id: randomUUID(),
    name: input.name.trim(),
    type: input.type,
    ministry: input.ministry ?? 'general',
    tags: normalizeList(input.tags, 50),
    platforms: normalizeList(input.platforms, 20) as DigitalAssetRecord['platforms'],
    sourceKind: input.sourceKind,
    episodeId: input.episodeId?.trim() || undefined,
    assetKey: input.assetKey?.trim() || undefined,
    externalUrl: input.externalUrl?.trim() || undefined,
    uploadedFileName: input.uploadedFileName?.trim() || undefined,
    uploadedMimeType: input.uploadedMimeType?.trim() || undefined,
    uploadedSizeBytes:
      typeof input.uploadedSizeBytes === 'number' ? input.uploadedSizeBytes : undefined,
    uploadedFilePath: input.uploadedFilePath?.trim() || undefined,
    notes: input.notes?.trim() || undefined,
    createdAt: now,
    updatedAt: now,
    ...(userId ? { userId } : {}),
  };
}

function applyPatch(record: DigitalAssetRecord, patch: UpdateDigitalAssetInput): DigitalAssetRecord {
  const next: DigitalAssetRecord = {
    ...record,
    ...(typeof patch.name === 'string' ? { name: patch.name.trim() } : {}),
    ...(patch.type ? { type: patch.type } : {}),
    ...(patch.ministry ? { ministry: patch.ministry } : {}),
    ...(Array.isArray(patch.tags) ? { tags: normalizeList(patch.tags, 50) } : {}),
    ...(Array.isArray(patch.platforms)
      ? { platforms: normalizeList(patch.platforms, 20) as DigitalAssetRecord['platforms'] }
      : {}),
    ...(patch.sourceKind ? { sourceKind: patch.sourceKind } : {}),
    ...(patch.episodeId !== undefined ? { episodeId: patch.episodeId.trim() || undefined } : {}),
    ...(patch.assetKey !== undefined ? { assetKey: patch.assetKey.trim() || undefined } : {}),
    ...(patch.externalUrl !== undefined
      ? { externalUrl: patch.externalUrl.trim() || undefined }
      : {}),
    ...(patch.uploadedFileName !== undefined
      ? { uploadedFileName: patch.uploadedFileName.trim() || undefined }
      : {}),
    ...(patch.uploadedMimeType !== undefined
      ? { uploadedMimeType: patch.uploadedMimeType.trim() || undefined }
      : {}),
    ...(patch.uploadedSizeBytes !== undefined
      ? { uploadedSizeBytes: patch.uploadedSizeBytes }
      : {}),
    ...(patch.uploadedFilePath !== undefined
      ? { uploadedFilePath: patch.uploadedFilePath.trim() || undefined }
      : {}),
    ...(patch.notes !== undefined ? { notes: patch.notes.trim() || undefined } : {}),
    updatedAt: new Date().toISOString(),
  };
  return next;
}

export interface DigitalAssetFilters {
  ministry?: string;
  type?: string;
  search?: string;
}

function canAccess(record: DigitalAssetRecord, userId?: string): boolean {
  if (!record.userId) return true;
  if (!userId) return false;
  return record.userId === userId;
}

export async function listDigitalAssets(
  filters: DigitalAssetFilters = {},
  userId?: string,
): Promise<DigitalAssetRecord[]> {
  const { ministry, type, search } = filters;
  let assets = (await readAssets()).filter(item => canAccess(item, userId));

  if (ministry && isDigitalMinistry(ministry)) {
    assets = assets.filter(item => item.ministry === ministry);
  }
  if (type && isDigitalAssetType(type)) {
    assets = assets.filter(item => item.type === type);
  }
  if (search?.trim()) {
    const needle = search.trim().toLowerCase();
    assets = assets.filter(item => {
      const haystack = [
        item.name,
        item.notes ?? '',
        item.ministry,
        item.type,
        ...(item.tags ?? []),
        ...(item.platforms ?? []),
      ]
        .join(' ')
        .toLowerCase();
      return haystack.includes(needle);
    });
  }

  return assets.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createDigitalAsset(
  input: CreateDigitalAssetInput,
  userId?: string,
): Promise<DigitalAssetRecord> {
  const assets = await readAssets();
  const created = buildRecord(input, userId);
  assets.push(created);
  await writeAssets(assets);
  return created;
}

export async function updateDigitalAsset(
  id: string,
  patch: UpdateDigitalAssetInput,
  userId?: string,
): Promise<DigitalAssetRecord | null> {
  const assets = await readAssets();
  const index = assets.findIndex(item => item.id === id && canAccess(item, userId));
  if (index < 0) return null;
  const updated = applyPatch(assets[index]!, patch);
  assets[index] = updated;
  await writeAssets(assets);
  return updated;
}

export async function deleteDigitalAsset(id: string, userId?: string): Promise<boolean> {
  const assets = await readAssets();
  const next = assets.filter(item => !(item.id === id && canAccess(item, userId)));
  if (next.length === assets.length) return false;
  await writeAssets(next);
  return true;
}
