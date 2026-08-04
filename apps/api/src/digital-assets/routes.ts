import type { FastifyInstance } from 'fastify';
import {
  isDigitalAssetType,
  isDigitalMinistry,
  type CreateDigitalAssetInput,
  type DigitalAssetSourceKind,
  type DigitalPlatform,
  type UpdateDigitalAssetInput,
} from '@creator-ai-studio/shared';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import {
  createDigitalAssetBody,
  updateDigitalAssetBody,
  uploadDigitalAssetBody,
} from '../http/schemas.js';
import { resolveDataPath } from '../storage/index.js';
import { canWriteWorkspaceContent } from '../team/store.js';
import {
  createDigitalAsset,
  deleteDigitalAsset,
  listDigitalAssets,
  updateDigitalAsset,
} from './store.js';

function route(prefix: string, path: string): string {
  return `${prefix}${path}`;
}

function normalizePlatforms(value: unknown): DigitalPlatform[] {
  if (!Array.isArray(value)) return [];
  const allowed: DigitalPlatform[] = ['youtube', 'facebook', 'instagram', 'tiktok', 'x', 'web', 'stream'];
  const set = new Set<DigitalPlatform>();
  for (const platform of value) {
    if (typeof platform !== 'string') continue;
    if (allowed.includes(platform as DigitalPlatform)) {
      set.add(platform as DigitalPlatform);
    }
  }
  return [...set];
}

function parseInput(body: Record<string, unknown>): CreateDigitalAssetInput {
  return {
    name: String(body.name ?? '').trim(),
    type: body.type as CreateDigitalAssetInput['type'],
    ministry: body.ministry as CreateDigitalAssetInput['ministry'],
    tags: Array.isArray(body.tags) ? body.tags.filter(t => typeof t === 'string') as string[] : [],
    platforms: normalizePlatforms(body.platforms),
    sourceKind: body.sourceKind as DigitalAssetSourceKind,
    episodeId: typeof body.episodeId === 'string' ? body.episodeId : undefined,
    assetKey: typeof body.assetKey === 'string' ? body.assetKey : undefined,
    externalUrl: typeof body.externalUrl === 'string' ? body.externalUrl : undefined,
    uploadedFileName:
      typeof body.uploadedFileName === 'string' ? body.uploadedFileName : undefined,
    uploadedMimeType:
      typeof body.uploadedMimeType === 'string' ? body.uploadedMimeType : undefined,
    uploadedSizeBytes:
      typeof body.uploadedSizeBytes === 'number' ? body.uploadedSizeBytes : undefined,
    uploadedFilePath:
      typeof body.uploadedFilePath === 'string' ? body.uploadedFilePath : undefined,
    notes: typeof body.notes === 'string' ? body.notes : undefined,
  };
}

function parsePatchInput(body: Record<string, unknown>): UpdateDigitalAssetInput {
  const out: UpdateDigitalAssetInput = {};
  if (typeof body.name === 'string') out.name = body.name;
  if (typeof body.type === 'string') out.type = body.type as UpdateDigitalAssetInput['type'];
  if (typeof body.ministry === 'string') out.ministry = body.ministry as UpdateDigitalAssetInput['ministry'];
  if (Array.isArray(body.tags)) out.tags = body.tags.filter(t => typeof t === 'string') as string[];
  if (Array.isArray(body.platforms)) out.platforms = normalizePlatforms(body.platforms);
  if (typeof body.sourceKind === 'string') out.sourceKind = body.sourceKind as DigitalAssetSourceKind;
  if (typeof body.episodeId === 'string') out.episodeId = body.episodeId;
  if (typeof body.assetKey === 'string') out.assetKey = body.assetKey;
  if (typeof body.externalUrl === 'string') out.externalUrl = body.externalUrl;
  if (typeof body.uploadedFileName === 'string') out.uploadedFileName = body.uploadedFileName;
  if (typeof body.uploadedMimeType === 'string') out.uploadedMimeType = body.uploadedMimeType;
  if (typeof body.uploadedSizeBytes === 'number') out.uploadedSizeBytes = body.uploadedSizeBytes;
  if (typeof body.uploadedFilePath === 'string') out.uploadedFilePath = body.uploadedFilePath;
  if (typeof body.notes === 'string') out.notes = body.notes;
  return out;
}

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]+/g, '_').slice(0, 120) || 'asset.bin';
}

function uploadRoot(): string {
  return path.join(resolveDataPath(), 'assets', 'uploads');
}

function absoluteUploadPath(relativePath: string): string {
  return path.join(resolveDataPath(), relativePath);
}

function validateInput(
  input: CreateDigitalAssetInput | UpdateDigitalAssetInput,
): { ok: true } | { ok: false; status: number; error: string } {
  if ('name' in input && input.name !== undefined && input.name.trim().length === 0) {
    return { ok: false, status: 400, error: 'name is required' };
  }
  if (input.type && !isDigitalAssetType(input.type)) {
    return { ok: false, status: 400, error: 'invalid type' };
  }
  if (input.ministry && !isDigitalMinistry(input.ministry)) {
    return { ok: false, status: 400, error: 'invalid ministry' };
  }

  const sourceKind = input.sourceKind;
  if (
    sourceKind &&
    sourceKind !== 'episode_asset' &&
    sourceKind !== 'external_url' &&
    sourceKind !== 'uploaded_file'
  ) {
    return { ok: false, status: 400, error: 'invalid sourceKind' };
  }

  if (sourceKind === 'episode_asset') {
    if (!input.episodeId?.trim()) {
      return { ok: false, status: 400, error: 'episodeId is required for episode_asset' };
    }
    if (!input.assetKey?.trim()) {
      return { ok: false, status: 400, error: 'assetKey is required for episode_asset' };
    }
  }

  if (sourceKind === 'external_url') {
    if (!input.externalUrl?.trim()) {
      return { ok: false, status: 400, error: 'externalUrl is required for external_url' };
    }
    if (!/^https?:\/\//i.test(input.externalUrl.trim())) {
      return { ok: false, status: 400, error: 'externalUrl must be http(s)' };
    }
  }

  if (sourceKind === 'uploaded_file') {
    if (!input.uploadedFilePath?.trim()) {
      return { ok: false, status: 400, error: 'uploadedFilePath is required for uploaded_file' };
    }
    if (!input.uploadedFileName?.trim()) {
      return { ok: false, status: 400, error: 'uploadedFileName is required for uploaded_file' };
    }
  }

  return { ok: true };
}

export function registerDigitalAssetRoutes(app: FastifyInstance, prefix: '' | '/api'): void {
  app.get(route(prefix, '/digital-assets'), async request => {
    const query = request.query as { ministry?: string; type?: string; search?: string };
    const items = await listDigitalAssets(
      {
        ministry: query.ministry,
        type: query.type,
        search: query.search,
      },
      request.userId,
    );
    return { items };
  });

  app.get(route(prefix, '/digital-assets/:id/file'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const items = await listDigitalAssets({}, request.userId);
    const found = items.find(item => item.id === id);
    if (!found || found.sourceKind !== 'uploaded_file' || !found.uploadedFilePath) {
      reply.code(404);
      return { error: 'digital asset file not found' };
    }
    const fullPath = absoluteUploadPath(found.uploadedFilePath);
    try {
      const data = await readFile(fullPath);
      reply.header(
        'Content-Disposition',
        `attachment; filename="${found.uploadedFileName ?? 'asset-file'}"`,
      );
      reply.type(found.uploadedMimeType ?? 'application/octet-stream');
      return data;
    } catch {
      reply.code(404);
      return { error: 'digital asset file not found on disk' };
    }
  });

  app.post(route(prefix, '/digital-assets'), { schema: { body: createDigitalAssetBody } }, async (request, reply) => {
    const canWrite = await canWriteWorkspaceContent(request.userId);
    if (!canWrite) {
      reply.code(403);
      return { error: 'forbidden', message: 'Tu rol no permite crear activos DAM' };
    }
    const body = (request.body ?? {}) as Record<string, unknown>;
    const input = parseInput(body);
    const validation = validateInput(input);
    if (!validation.ok) {
      reply.code(validation.status);
      return { error: validation.error };
    }
    const created = await createDigitalAsset(input, request.userId);
    reply.code(201);
    return created;
  });

  app.post(
    route(prefix, '/digital-assets/upload'),
    { schema: { body: uploadDigitalAssetBody } },
    async (request, reply) => {
      const canWrite = await canWriteWorkspaceContent(request.userId);
      if (!canWrite) {
        reply.code(403);
        return { error: 'forbidden', message: 'Tu rol no permite subir activos DAM' };
      }

      const body = (request.body ?? {}) as {
        name?: string;
        type?: string;
        ministry?: string;
        tags?: string[];
        platforms?: string[];
        notes?: string;
        file?: { name?: string; mimeType?: string; contentBase64?: string };
      };

      const file = body.file;
      if (!file?.name || !file.contentBase64) {
        reply.code(400);
        return { error: 'file payload is required' };
      }

      const contentBase64 = file.contentBase64.trim();
      const base64BytesEstimate = Math.ceil((contentBase64.length * 3) / 4);
      if (base64BytesEstimate > 20 * 1024 * 1024) {
        reply.code(413);
        return { error: 'file too large (max 20MB)' };
      }

      const binary = Buffer.from(contentBase64, 'base64');
      const safeName = safeFileName(file.name);
      const dirName = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      const targetDir = path.join(uploadRoot(), dirName);
      await mkdir(targetDir, { recursive: true });
      const fullPath = path.join(targetDir, safeName);
      await writeFile(fullPath, binary);

      const relativePath = path.join('assets', 'uploads', dirName, safeName);

      const input: CreateDigitalAssetInput = {
        name: body.name?.trim() || safeName,
        type: body.type as CreateDigitalAssetInput['type'],
        ministry: body.ministry as CreateDigitalAssetInput['ministry'],
        tags: Array.isArray(body.tags) ? body.tags : [],
        platforms: normalizePlatforms(body.platforms),
        notes: body.notes,
        sourceKind: 'uploaded_file',
        uploadedFilePath: relativePath,
        uploadedFileName: safeName,
        uploadedMimeType: file.mimeType?.trim() || 'application/octet-stream',
        uploadedSizeBytes: binary.byteLength,
      };

      const validation = validateInput(input);
      if (!validation.ok) {
        reply.code(validation.status);
        return { error: validation.error };
      }

      const created = await createDigitalAsset(input, request.userId);
      reply.code(201);
      return created;
    },
  );

  app.patch(
    route(prefix, '/digital-assets/:id'),
    { schema: { body: updateDigitalAssetBody } },
    async (request, reply) => {
      const canWrite = await canWriteWorkspaceContent(request.userId);
      if (!canWrite) {
        reply.code(403);
        return { error: 'forbidden', message: 'Tu rol no permite editar activos DAM' };
      }
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as Record<string, unknown>;
      const patch = parsePatchInput(body);
      const validation = validateInput(patch);
      if (!validation.ok) {
        reply.code(validation.status);
        return { error: validation.error };
      }
      const updated = await updateDigitalAsset(id, patch, request.userId);
      if (!updated) {
        reply.code(404);
        return { error: 'digital asset not found' };
      }
      return updated;
    },
  );

  app.delete(route(prefix, '/digital-assets/:id'), async (request, reply) => {
    const canWrite = await canWriteWorkspaceContent(request.userId);
    if (!canWrite) {
      reply.code(403);
      return { error: 'forbidden', message: 'Tu rol no permite eliminar activos DAM' };
    }
    const { id } = request.params as { id: string };
    const ok = await deleteDigitalAsset(id, request.userId);
    if (!ok) {
      reply.code(404);
      return { error: 'digital asset not found' };
    }
    return { ok: true, id };
  });
}
