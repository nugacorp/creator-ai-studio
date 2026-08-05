import { createReadStream } from 'node:fs';
import { stat } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  isAssetKind,
  type Asset,
  type AssetKind,
  type AssetVersion,
} from '@creator-ai-studio/shared';
import { handleChurchError, requireChurchMember, requirePermission } from '../auth/rbac.js';
import { updateAssetBody } from '../http/church-schemas.js';
import {
  AssetTooLargeError,
  deleteAssetFiles,
  generateAssetThumbnail,
  kindFromMimeType,
  MAX_ASSET_BYTES,
  resolveAssetPath,
  storeAssetStream,
} from './asset-files.js';
import { toAsset, type AssetRow } from './mappers.js';
import { ChurchDbError } from './postgrest.js';

const ASSET_SELECT = '*';

function route(prefix: string, path: string): string {
  return `${prefix}${path}`;
}

/** Escape a value for a PostgREST `ilike` filter. */
function likeValue(value: string): string {
  return `*${value.replace(/[*,()]/g, ' ').trim()}*`;
}

function parseTags(raw: unknown): string[] {
  if (Array.isArray(raw)) {
    return raw.filter((tag): tag is string => typeof tag === 'string' && tag.trim().length > 0);
  }
  if (typeof raw === 'string' && raw.trim()) {
    return raw
      .split(',')
      .map(tag => tag.trim())
      .filter(Boolean)
      .slice(0, 30);
  }
  return [];
}

export function registerChurchAssetRoutes(app: FastifyInstance, prefix: '' | '/api'): void {
  /**
   * Search the library. Text search rides the Spanish tsvector index, so
   * "Romanos" finds a sermon tagged, titled or preached about Romans.
   */
  app.get(
    route(prefix, '/church/assets'),
    { preHandler: requirePermission('library.view') },
    async (request, reply) => {
      const context = request.church!;
      const query = request.query as Record<string, string | undefined>;

      const params: Record<string, string | undefined> = {
        select: ASSET_SELECT,
        church_id: `eq.${context.churchId}`,
        order: 'created_at.desc',
        limit: String(Math.min(Number(query.limit ?? 200) || 200, 500)),
      };

      if (query.ministryId) params.ministry_id = `eq.${query.ministryId}`;
      if (query.kind && isAssetKind(query.kind)) params.kind = `eq.${query.kind}`;
      if (query.series) params.series = `ilike.${likeValue(query.series)}`;
      if (query.preacher) params.preacher = `ilike.${likeValue(query.preacher)}`;
      if (query.bibleRef) params.bible_ref = `ilike.${likeValue(query.bibleRef)}`;
      if (query.tag) params.tags = `cs.{${query.tag.replace(/[{}"]/g, '')}}`;
      // Two bounds on one column need `and=(...)`: the params map has one slot
      // per key, so `service_date=gte.X&service_date=lte.Y` is not expressible.
      if (query.from && query.to) {
        params.and = `(service_date.gte.${query.from},service_date.lte.${query.to})`;
      } else if (query.from) {
        params.service_date = `gte.${query.from}`;
      } else if (query.to) {
        params.service_date = `lte.${query.to}`;
      }
      if (query.search?.trim()) {
        // websearch_to_tsquery handles quoted phrases and "or" the way users type.
        params.search_tsv = `wfts(spanish).${query.search.trim()}`;
      }

      try {
        const rows = await context.db.select<AssetRow>('church_assets', { params });
        return { items: rows.map(toAsset) satisfies Asset[] };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.get(
    route(prefix, '/church/assets/:id'),
    { preHandler: requirePermission('library.view') },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      try {
        const row = await context.db.selectOne<AssetRow>('church_assets', {
          params: { select: ASSET_SELECT, id: `eq.${id}`, church_id: `eq.${context.churchId}` },
        });
        if (!row) {
          reply.code(404);
          return { error: 'not_found', message: 'Activo no encontrado' };
        }
        return toAsset(row);
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  /**
   * Upload. The file streams straight to the volume; metadata fields ride
   * along as multipart text parts. Returns immediately after the row is
   * written and renders the thumbnail in the background, so a 2 GB sermon
   * does not hold the request open while ffmpeg works.
   */
  app.post(
    route(prefix, '/church/assets/upload'),
    { preHandler: requirePermission('asset.upload') },
    async (request, reply) => {
      const context = request.church!;

      if (!request.isMultipart()) {
        reply.code(415);
        return {
          error: 'unsupported_media_type',
          message: 'Usa multipart/form-data para subir archivos',
        };
      }

      const fields: Record<string, string> = {};
      const assetId = randomUUID();
      const createdAt = new Date();
      let stored: Awaited<ReturnType<typeof storeAssetStream>> | null = null;
      let detectedMime = 'application/octet-stream';

      try {
        for await (const part of request.parts()) {
          if (part.type === 'file') {
            if (stored) {
              part.file.resume();
              continue;
            }
            detectedMime = part.mimetype || 'application/octet-stream';
            stored = await storeAssetStream({
              churchId: context.churchId,
              assetId,
              version: 1,
              fileName: part.filename ?? 'archivo.bin',
              source: part.file,
              createdAt,
            });
          } else if (typeof part.value === 'string') {
            fields[part.fieldname] = part.value;
          }
        }
      } catch (error) {
        if (error instanceof AssetTooLargeError) {
          reply.code(413);
          return { error: 'file_too_large', message: error.message, maxBytes: MAX_ASSET_BYTES };
        }
        throw error;
      }

      if (!stored) {
        reply.code(400);
        return { error: 'bad_request', message: 'No se recibió ningún archivo' };
      }

      const kind: AssetKind = isAssetKind(fields.kind) ? fields.kind : kindFromMimeType(detectedMime);
      const version: AssetVersion = {
        version: 1,
        storagePath: stored.relativePath,
        sizeBytes: stored.sizeBytes,
        mimeType: detectedMime,
        originalFileName: stored.fileName,
        ...(request.userId ? { uploadedBy: request.userId } : {}),
        uploadedAt: createdAt.toISOString(),
      };

      try {
        const row = await context.db.insertOne<AssetRow>('church_assets', {
          id: assetId,
          church_id: context.churchId,
          ministry_id: fields.ministryId || null,
          name: (fields.name?.trim() || stored.fileName).slice(0, 220),
          kind,
          storage_path: stored.relativePath,
          mime_type: detectedMime,
          size_bytes: stored.sizeBytes,
          current_version: 1,
          versions: [version],
          series: fields.series?.trim() || null,
          preacher: fields.preacher?.trim() || null,
          bible_ref: fields.bibleRef?.trim() || null,
          tags: parseTags(fields.tags),
          service_date: fields.serviceDate?.trim() || null,
          uploaded_by: request.userId ?? null,
          created_at: createdAt.toISOString(),
        });

        void renderThumbnailInBackground(app, {
          churchId: context.churchId,
          assetId,
          kind,
          storagePath: stored.relativePath,
          createdAt,
          accessToken: request.accessToken as string,
        });

        reply.code(201);
        return toAsset(row);
      } catch (error) {
        // The row failed, so the bytes are orphaned — clean them up.
        await deleteAssetFiles(context.churchId, assetId, createdAt).catch(() => undefined);
        return handleChurchError(reply, error);
      }
    },
  );

  /** Upload a new version of an existing asset. v1 stays reachable. */
  app.post(
    route(prefix, '/church/assets/:id/versions'),
    { preHandler: requirePermission('asset.upload') },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };

      if (!request.isMultipart()) {
        reply.code(415);
        return { error: 'unsupported_media_type', message: 'Usa multipart/form-data' };
      }

      let existing: AssetRow | null;
      try {
        existing = await context.db.selectOne<AssetRow>('church_assets', {
          params: { select: ASSET_SELECT, id: `eq.${id}`, church_id: `eq.${context.churchId}` },
        });
      } catch (error) {
        return handleChurchError(reply, error);
      }

      if (!existing) {
        reply.code(404);
        return { error: 'not_found', message: 'Activo no encontrado' };
      }

      const createdAt = new Date(existing.created_at);
      const nextVersion = existing.current_version + 1;
      let stored: Awaited<ReturnType<typeof storeAssetStream>> | null = null;
      let detectedMime = existing.mime_type;

      try {
        for await (const part of request.parts()) {
          if (part.type !== 'file') continue;
          if (stored) {
            part.file.resume();
            continue;
          }
          detectedMime = part.mimetype || existing.mime_type;
          stored = await storeAssetStream({
            churchId: context.churchId,
            assetId: id,
            version: nextVersion,
            fileName: part.filename ?? 'archivo.bin',
            source: part.file,
            createdAt,
          });
        }
      } catch (error) {
        if (error instanceof AssetTooLargeError) {
          reply.code(413);
          return { error: 'file_too_large', message: error.message, maxBytes: MAX_ASSET_BYTES };
        }
        throw error;
      }

      if (!stored) {
        reply.code(400);
        return { error: 'bad_request', message: 'No se recibió ningún archivo' };
      }

      const version: AssetVersion = {
        version: nextVersion,
        storagePath: stored.relativePath,
        sizeBytes: stored.sizeBytes,
        mimeType: detectedMime,
        originalFileName: stored.fileName,
        ...(request.userId ? { uploadedBy: request.userId } : {}),
        uploadedAt: new Date().toISOString(),
      };

      try {
        const rows = await context.db.update<AssetRow>(
          'church_assets',
          {
            storage_path: stored.relativePath,
            mime_type: detectedMime,
            size_bytes: stored.sizeBytes,
            current_version: nextVersion,
            versions: [...(existing.versions ?? []), version],
          },
          { id: `eq.${id}`, church_id: `eq.${context.churchId}` },
        );
        const row = rows[0];
        if (!row) {
          reply.code(404);
          return { error: 'not_found', message: 'Activo no encontrado' };
        }

        void renderThumbnailInBackground(app, {
          churchId: context.churchId,
          assetId: id,
          kind: row.kind,
          storagePath: stored.relativePath,
          createdAt,
          accessToken: request.accessToken as string,
        });

        return toAsset(row);
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.patch(
    route(prefix, '/church/assets/:id'),
    { schema: { body: updateAssetBody }, preHandler: requirePermission('asset.upload') },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;

      try {
        const rows = await context.db.update<AssetRow>(
          'church_assets',
          {
            ...(typeof body.name === 'string' ? { name: body.name.trim() } : {}),
            ...(isAssetKind(body.kind) ? { kind: body.kind } : {}),
            ...(body.ministryId !== undefined ? { ministry_id: body.ministryId || null } : {}),
            ...(body.series !== undefined ? { series: String(body.series).trim() || null } : {}),
            ...(body.preacher !== undefined
              ? { preacher: String(body.preacher).trim() || null }
              : {}),
            ...(body.bibleRef !== undefined
              ? { bible_ref: String(body.bibleRef).trim() || null }
              : {}),
            ...(body.tags !== undefined ? { tags: parseTags(body.tags) } : {}),
            ...(body.serviceDate !== undefined
              ? { service_date: String(body.serviceDate).trim() || null }
              : {}),
          },
          { id: `eq.${id}`, church_id: `eq.${context.churchId}` },
        );
        const row = rows[0];
        if (!row) {
          reply.code(404);
          return { error: 'not_found', message: 'Activo no encontrado' };
        }
        return toAsset(row);
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.delete(
    route(prefix, '/church/assets/:id'),
    { preHandler: requirePermission('asset.delete') },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      try {
        const existing = await context.db.selectOne<AssetRow>('church_assets', {
          params: { select: 'id,created_at', id: `eq.${id}`, church_id: `eq.${context.churchId}` },
        });
        if (!existing) {
          reply.code(404);
          return { error: 'not_found', message: 'Activo no encontrado' };
        }
        await context.db.delete('church_assets', {
          id: `eq.${id}`,
          church_id: `eq.${context.churchId}`,
        });
        await deleteAssetFiles(context.churchId, id, new Date(existing.created_at)).catch(
          () => undefined,
        );
        return { ok: true, id };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  /** Stream the file itself. Supports Range so video scrubbing works. */
  app.get(
    route(prefix, '/church/assets/:id/file'),
    { preHandler: requirePermission('library.view') },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      const query = request.query as { version?: string; download?: string };

      let row: AssetRow | null;
      try {
        row = await context.db.selectOne<AssetRow>('church_assets', {
          params: { select: ASSET_SELECT, id: `eq.${id}`, church_id: `eq.${context.churchId}` },
        });
      } catch (error) {
        return handleChurchError(reply, error);
      }

      if (!row) {
        reply.code(404);
        return { error: 'not_found', message: 'Activo no encontrado' };
      }

      const versions = row.versions ?? [];
      const wanted = query.version ? Number(query.version) : row.current_version;
      const selected = versions.find(v => v.version === wanted);
      const relativePath = selected?.storagePath ?? row.storage_path;
      const fileName = selected?.originalFileName ?? path.basename(relativePath);

      return streamFile(reply, request.headers.range, {
        relativePath,
        mimeType: selected?.mimeType ?? row.mime_type,
        fileName,
        asDownload: query.download === '1',
      });
    },
  );

  /** The generated preview image. 404 until the thumbnail job finishes. */
  app.get(
    route(prefix, '/church/assets/:id/thumbnail'),
    { preHandler: requirePermission('library.view') },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };

      let row: AssetRow | null;
      try {
        row = await context.db.selectOne<AssetRow>('church_assets', {
          params: {
            select: 'id,thumbnail_path',
            id: `eq.${id}`,
            church_id: `eq.${context.churchId}`,
          },
        });
      } catch (error) {
        return handleChurchError(reply, error);
      }

      if (!row?.thumbnail_path) {
        reply.code(404);
        return { error: 'not_found', message: 'Miniatura no disponible todavía' };
      }

      return streamFile(reply, undefined, {
        relativePath: row.thumbnail_path,
        mimeType: 'image/jpeg',
        fileName: 'thumb.jpg',
        asDownload: false,
      });
    },
  );

  /** Storage totals for the library header — real bytes, counted in Postgres. */
  app.get(
    route(prefix, '/church/assets-summary'),
    { preHandler: requireChurchMember() },
    async (request, reply) => {
      const context = request.church!;
      try {
        const rows = await context.db.select<{ kind: AssetKind; size_bytes: string | number }>(
          'church_assets',
          { params: { select: 'kind,size_bytes', church_id: `eq.${context.churchId}` } },
        );
        const byKind: Record<string, { count: number; bytes: number }> = {};
        let totalBytes = 0;
        for (const row of rows) {
          const bytes = Number(row.size_bytes ?? 0);
          totalBytes += bytes;
          const bucket = (byKind[row.kind] ??= { count: 0, bytes: 0 });
          bucket.count += 1;
          bucket.bytes += bytes;
        }
        return { totalAssets: rows.length, totalBytes, byKind };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );
}

interface StreamOptions {
  relativePath: string;
  mimeType: string;
  fileName: string;
  asDownload: boolean;
}

/** Serve a stored file, honoring HTTP Range for seekable video playback. */
async function streamFile(
  reply: FastifyReply,
  range: string | undefined,
  options: StreamOptions,
): Promise<unknown> {
  let absolute: string;
  try {
    absolute = resolveAssetPath(options.relativePath);
  } catch {
    reply.code(400);
    return { error: 'bad_request', message: 'Ruta de archivo inválida' };
  }

  let size: number;
  try {
    size = (await stat(absolute)).size;
  } catch {
    reply.code(404);
    return { error: 'not_found', message: 'El archivo ya no está en el disco del servidor' };
  }

  reply.header('accept-ranges', 'bytes');
  reply.header(
    'content-disposition',
    `${options.asDownload ? 'attachment' : 'inline'}; filename="${options.fileName}"`,
  );
  reply.type(options.mimeType);

  const match = range?.match(/bytes=(\d*)-(\d*)/);
  if (match) {
    const start = match[1] ? Number(match[1]) : 0;
    const end = match[2] ? Math.min(Number(match[2]), size - 1) : size - 1;
    if (Number.isNaN(start) || Number.isNaN(end) || start > end || start >= size) {
      reply.code(416).header('content-range', `bytes */${size}`);
      return reply.send();
    }
    reply.code(206);
    reply.header('content-range', `bytes ${start}-${end}/${size}`);
    reply.header('content-length', String(end - start + 1));
    return reply.send(createReadStream(absolute, { start, end }));
  }

  reply.header('content-length', String(size));
  return reply.send(createReadStream(absolute));
}

/**
 * Render the preview after responding. ffmpeg on a 2 GB file takes seconds;
 * the uploader should not wait for it, and a failure must not fail the upload.
 */
async function renderThumbnailInBackground(
  app: FastifyInstance,
  options: {
    churchId: string;
    assetId: string;
    kind: AssetKind;
    storagePath: string;
    createdAt: Date;
    accessToken: string;
  },
): Promise<void> {
  try {
    const thumbnailPath = await generateAssetThumbnail({
      churchId: options.churchId,
      assetId: options.assetId,
      kind: options.kind,
      sourceRelativePath: options.storagePath,
      createdAt: options.createdAt,
    });
    if (!thumbnailPath) return;

    const { userClient } = await import('./postgrest.js');
    await userClient(options.accessToken).update(
      'church_assets',
      { thumbnail_path: thumbnailPath },
      { id: `eq.${options.assetId}`, church_id: `eq.${options.churchId}` },
      { prefer: 'return=minimal' },
    );
  } catch (error) {
    const message =
      error instanceof ChurchDbError || error instanceof Error ? error.message : 'unknown';
    app.log.warn({ assetId: options.assetId, err: message }, 'thumbnail generation failed');
  }
}
