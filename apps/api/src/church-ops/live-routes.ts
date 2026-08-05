import { randomUUID } from 'node:crypto';
import type { FastifyInstance } from 'fastify';
import {
  DEFAULT_PREFLIGHT_CHECKLIST,
  type ChecklistItem,
  type LiveCrewAssignment,
  type LiveEvent,
  type LiveEventStatus,
  type LiveIncident,
} from '@creator-ai-studio/shared';
import { handleChurchError, requireChurchMember, requirePermission } from '../auth/rbac.js';
import {
  addIncidentBody,
  createLiveEventBody,
  toggleChecklistItemBody,
  updateLiveEventBody,
} from '../http/church-schemas.js';
import { toLiveEvent, type LiveEventRow } from './mappers.js';

function route(prefix: string, path: string): string {
  return `${prefix}${path}`;
}

function buildChecklist(labels: readonly string[]): ChecklistItem[] {
  return labels
    .map(label => label.trim())
    .filter(Boolean)
    .map(label => ({ id: randomUUID(), label, done: false }));
}

export function registerChurchLiveRoutes(app: FastifyInstance, prefix: '' | '/api'): void {
  app.get(
    route(prefix, '/church/live-events'),
    { preHandler: requireChurchMember() },
    async (request, reply) => {
      const context = request.church!;
      const query = request.query as { status?: string; from?: string; limit?: string };

      const params: Record<string, string | undefined> = {
        select: '*',
        church_id: `eq.${context.churchId}`,
        order: 'scheduled_at.desc',
        limit: String(Math.min(Number(query.limit ?? 100) || 100, 300)),
      };
      if (query.status) params.status = `eq.${query.status}`;
      if (query.from) params.scheduled_at = `gte.${query.from}`;

      try {
        const rows = await context.db.select<LiveEventRow>('live_events', { params });
        return { items: rows.map(toLiveEvent) satisfies LiveEvent[] };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.get(
    route(prefix, '/church/live-events/:id'),
    { preHandler: requireChurchMember() },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      try {
        const row = await context.db.selectOne<LiveEventRow>('live_events', {
          params: { select: '*', id: `eq.${id}`, church_id: `eq.${context.churchId}` },
        });
        if (!row) {
          reply.code(404);
          return { error: 'not_found', message: 'Evento no encontrado' };
        }
        return toLiveEvent(row);
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.post(
    route(prefix, '/church/live-events'),
    { schema: { body: createLiveEventBody }, preHandler: requirePermission('live.control') },
    async (request, reply) => {
      const context = request.church!;
      const body = request.body as {
        title: string;
        scheduledAt: string;
        targetIds?: string[];
        crew?: LiveCrewAssignment[];
        checklist?: string[];
        obsProfile?: string;
      };

      const scheduledAt = new Date(body.scheduledAt);
      if (Number.isNaN(scheduledAt.getTime())) {
        reply.code(400);
        return { error: 'bad_request', message: 'Fecha del evento inválida' };
      }

      try {
        const row = await context.db.insertOne<LiveEventRow>('live_events', {
          church_id: context.churchId,
          title: body.title.trim(),
          scheduled_at: scheduledAt.toISOString(),
          status: 'planeado',
          target_ids: body.targetIds ?? [],
          crew: body.crew ?? [],
          checklist: buildChecklist(
            body.checklist?.length ? body.checklist : DEFAULT_PREFLIGHT_CHECKLIST,
          ),
          obs_profile: body.obsProfile?.trim() || null,
          incidents: [],
          created_by: request.userId ?? null,
        });
        reply.code(201);
        return toLiveEvent(row);
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.patch(
    route(prefix, '/church/live-events/:id'),
    { schema: { body: updateLiveEventBody }, preHandler: requirePermission('live.control') },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      const body = request.body as {
        title?: string;
        scheduledAt?: string;
        status?: LiveEventStatus;
        targetIds?: string[];
        obsProfile?: string;
        recordingAssetId?: string;
        crew?: LiveCrewAssignment[];
      };

      const patch: Record<string, unknown> = {
        ...(body.title ? { title: body.title.trim() } : {}),
        ...(body.status ? { status: body.status } : {}),
        ...(body.targetIds ? { target_ids: body.targetIds } : {}),
        ...(body.crew ? { crew: body.crew } : {}),
        ...(body.obsProfile !== undefined ? { obs_profile: body.obsProfile.trim() || null } : {}),
        ...(body.recordingAssetId !== undefined
          ? { recording_asset_id: body.recordingAssetId || null }
          : {}),
      };

      if (body.scheduledAt) {
        const when = new Date(body.scheduledAt);
        if (Number.isNaN(when.getTime())) {
          reply.code(400);
          return { error: 'bad_request', message: 'Fecha del evento inválida' };
        }
        patch.scheduled_at = when.toISOString();
      }

      if (Object.keys(patch).length === 0) {
        reply.code(400);
        return { error: 'bad_request', message: 'No hay cambios que aplicar' };
      }

      try {
        const rows = await context.db.update<LiveEventRow>('live_events', patch, {
          id: `eq.${id}`,
          church_id: `eq.${context.churchId}`,
        });
        const row = rows[0];
        if (!row) {
          reply.code(404);
          return { error: 'not_found', message: 'Evento no encontrado' };
        }
        return toLiveEvent(row);
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.delete(
    route(prefix, '/church/live-events/:id'),
    { preHandler: requirePermission('live.control') },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      try {
        await context.db.delete('live_events', {
          id: `eq.${id}`,
          church_id: `eq.${context.churchId}`,
        });
        return { ok: true, id };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  /**
   * Tick a preflight item. Records *who* checked it and *when* — after a
   * failed service, "audio said it was fine at 9:52" is the useful fact.
   */
  app.patch(
    route(prefix, '/church/live-events/:id/checklist/:itemId'),
    { schema: { body: toggleChecklistItemBody }, preHandler: requirePermission('live.control') },
    async (request, reply) => {
      const context = request.church!;
      const { id, itemId } = request.params as { id: string; itemId: string };
      const { done } = request.body as { done: boolean };

      try {
        const existing = await context.db.selectOne<LiveEventRow>('live_events', {
          params: { select: '*', id: `eq.${id}`, church_id: `eq.${context.churchId}` },
        });
        if (!existing) {
          reply.code(404);
          return { error: 'not_found', message: 'Evento no encontrado' };
        }

        const checklist = (existing.checklist ?? []).map(item =>
          item.id === itemId
            ? {
                ...item,
                done,
                ...(done
                  ? { checkedBy: request.userId, checkedAt: new Date().toISOString() }
                  : { checkedBy: undefined, checkedAt: undefined }),
              }
            : item,
        );

        if (!checklist.some(item => item.id === itemId)) {
          reply.code(404);
          return { error: 'not_found', message: 'Ítem del checklist no encontrado' };
        }

        const rows = await context.db.update<LiveEventRow>(
          'live_events',
          { checklist },
          { id: `eq.${id}`, church_id: `eq.${context.churchId}` },
        );
        return toLiveEvent(rows[0] as LiveEventRow);
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.post(
    route(prefix, '/church/live-events/:id/incidents'),
    { schema: { body: addIncidentBody }, preHandler: requirePermission('live.control') },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      const { note, severity } = request.body as {
        note: string;
        severity?: LiveIncident['severity'];
      };

      try {
        const existing = await context.db.selectOne<LiveEventRow>('live_events', {
          params: { select: '*', id: `eq.${id}`, church_id: `eq.${context.churchId}` },
        });
        if (!existing) {
          reply.code(404);
          return { error: 'not_found', message: 'Evento no encontrado' };
        }

        const incident: LiveIncident = {
          id: randomUUID(),
          at: new Date().toISOString(),
          severity: severity ?? 'info',
          note: note.trim(),
          ...(request.userId ? { reportedBy: request.userId } : {}),
        };

        const rows = await context.db.update<LiveEventRow>(
          'live_events',
          { incidents: [...(existing.incidents ?? []), incident] },
          { id: `eq.${id}`, church_id: `eq.${context.churchId}` },
        );
        reply.code(201);
        return toLiveEvent(rows[0] as LiveEventRow);
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );
}
