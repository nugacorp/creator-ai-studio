import type { FastifyInstance } from 'fastify';
import {
  AUTO_CAPABLE_PLATFORMS,
  PLATFORM_DEFAULT_PRESET,
  type CalendarEntry,
  type PublishMode,
  type PublishPlatform,
  type PublishTarget,
  type RenderPreset,
} from '@creator-ai-studio/shared';
import { handleChurchError, requireChurchMember, requirePermission } from '../auth/rbac.js';
import {
  createPublishTargetBody,
  scheduleEntryBody,
  updateCalendarEntryBody,
  updatePublishTargetBody,
} from '../http/church-schemas.js';
import {
  toCalendarEntry,
  toProduction,
  toPublishTarget,
  type CalendarEntryRow,
  type ProductionRow,
  type PublishTargetRow,
} from './mappers.js';

function route(prefix: string, path: string): string {
  return `${prefix}${path}`;
}

/**
 * A target's honest mode. Instagram and TikTok cannot publish unattended in
 * practice (AD-3), so asking for `auto` there silently downgrades to
 * `assisted` rather than promising something the connector cannot deliver.
 */
function resolveMode(platform: PublishPlatform, requested: PublishMode | undefined): PublishMode {
  if (requested === 'auto' && AUTO_CAPABLE_PLATFORMS.includes(platform)) return 'auto';
  return 'assisted';
}

export function registerChurchCalendarRoutes(app: FastifyInstance, prefix: '' | '/api'): void {
  // --- Publish targets ----------------------------------------------------

  app.get(
    route(prefix, '/church/targets'),
    { preHandler: requireChurchMember() },
    async (request, reply) => {
      const context = request.church!;
      try {
        const rows = await context.db.select<PublishTargetRow>('publish_targets', {
          params: { select: '*', church_id: `eq.${context.churchId}`, order: 'display_name.asc' },
        });
        return {
          items: rows.map(toPublishTarget) satisfies PublishTarget[],
          autoCapablePlatforms: AUTO_CAPABLE_PLATFORMS,
        };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.post(
    route(prefix, '/church/targets'),
    {
      schema: { body: createPublishTargetBody },
      preHandler: requirePermission('credentials.manage'),
    },
    async (request, reply) => {
      const context = request.church!;
      const body = request.body as {
        platform: PublishPlatform;
        displayName: string;
        mode?: PublishMode;
        credentialsRef?: string;
        renderPreset?: RenderPreset;
      };
      try {
        const row = await context.db.insertOne<PublishTargetRow>('publish_targets', {
          church_id: context.churchId,
          platform: body.platform,
          display_name: body.displayName.trim(),
          mode: resolveMode(body.platform, body.mode),
          credentials_ref: body.credentialsRef?.trim() || null,
          render_preset: body.renderPreset ?? PLATFORM_DEFAULT_PRESET[body.platform],
        });
        reply.code(201);
        return toPublishTarget(row);
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.patch(
    route(prefix, '/church/targets/:id'),
    {
      schema: { body: updatePublishTargetBody },
      preHandler: requirePermission('credentials.manage'),
    },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      const body = request.body as {
        displayName?: string;
        mode?: PublishMode;
        credentialsRef?: string;
        renderPreset?: RenderPreset;
        isActive?: boolean;
      };

      try {
        const existing = await context.db.selectOne<PublishTargetRow>('publish_targets', {
          params: { select: '*', id: `eq.${id}`, church_id: `eq.${context.churchId}` },
        });
        if (!existing) {
          reply.code(404);
          return { error: 'not_found', message: 'Destino no encontrado' };
        }

        const rows = await context.db.update<PublishTargetRow>(
          'publish_targets',
          {
            ...(body.displayName ? { display_name: body.displayName.trim() } : {}),
            ...(body.mode ? { mode: resolveMode(existing.platform, body.mode) } : {}),
            ...(body.credentialsRef !== undefined
              ? { credentials_ref: body.credentialsRef.trim() || null }
              : {}),
            ...(body.renderPreset ? { render_preset: body.renderPreset } : {}),
            ...(body.isActive !== undefined ? { is_active: body.isActive } : {}),
          },
          { id: `eq.${id}`, church_id: `eq.${context.churchId}` },
        );
        return toPublishTarget(rows[0] as PublishTargetRow);
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.delete(
    route(prefix, '/church/targets/:id'),
    { preHandler: requirePermission('credentials.manage') },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      try {
        await context.db.delete('publish_targets', {
          id: `eq.${id}`,
          church_id: `eq.${context.churchId}`,
        });
        return { ok: true, id };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  // --- Calendar -----------------------------------------------------------

  app.get(
    route(prefix, '/church/calendar'),
    { preHandler: requireChurchMember() },
    async (request, reply) => {
      const context = request.church!;
      const query = request.query as { from?: string; to?: string; status?: string };

      const params: Record<string, string | undefined> = {
        select: '*,productions(*)',
        church_id: `eq.${context.churchId}`,
        order: 'scheduled_for.asc',
        limit: '500',
      };
      if (query.status) params.status = `eq.${query.status}`;
      if (query.from && query.to) {
        params.and = `(scheduled_for.gte.${query.from},scheduled_for.lte.${query.to})`;
      } else if (query.from) {
        params.scheduled_for = `gte.${query.from}`;
      } else if (query.to) {
        params.scheduled_for = `lte.${query.to}`;
      }

      try {
        const rows = await context.db.select<CalendarEntryRow & { productions: ProductionRow | null }>(
          'calendar_entries',
          { params },
        );
        return {
          items: rows.map(row => ({
            entry: toCalendarEntry(row),
            production: row.productions ? toProduction(row.productions) : null,
          })),
        };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  /**
   * Schedule one production (or live event) to several destinations at once.
   * One row per target, because each destination fails and retries on its own.
   */
  app.post(
    route(prefix, '/church/calendar'),
    { schema: { body: scheduleEntryBody }, preHandler: requirePermission('production.publish') },
    async (request, reply) => {
      const context = request.church!;
      const body = request.body as {
        targetIds: string[];
        productionId?: string;
        liveEventId?: string;
        scheduledFor: string;
      };

      if (!body.productionId && !body.liveEventId) {
        reply.code(400);
        return {
          error: 'bad_request',
          message: 'Indica productionId o liveEventId para programar',
        };
      }

      const scheduledFor = new Date(body.scheduledFor);
      if (Number.isNaN(scheduledFor.getTime())) {
        reply.code(400);
        return { error: 'bad_request', message: 'Fecha de programación inválida' };
      }

      try {
        // A production must be approved before it can be queued for publishing.
        if (body.productionId) {
          const production = await context.db.selectOne<ProductionRow>('productions', {
            params: {
              select: 'id,status,title',
              id: `eq.${body.productionId}`,
              church_id: `eq.${context.churchId}`,
            },
          });
          if (!production) {
            reply.code(404);
            return { error: 'not_found', message: 'Producción no encontrada' };
          }
          if (production.status !== 'aprobado' && production.status !== 'publicado') {
            reply.code(409);
            return {
              error: 'approval_required',
              message: `"${production.title}" debe estar aprobada antes de programarse.`,
            };
          }
        }

        const rows = await context.db.insert<CalendarEntryRow>(
          'calendar_entries',
          body.targetIds.map(targetId => ({
            church_id: context.churchId,
            production_id: body.productionId ?? null,
            live_event_id: body.liveEventId ?? null,
            target_id: targetId,
            scheduled_for: scheduledFor.toISOString(),
            status: 'programado',
            created_by: request.userId ?? null,
          })),
        );
        reply.code(201);
        return { items: rows.map(toCalendarEntry) satisfies CalendarEntry[] };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.patch(
    route(prefix, '/church/calendar/:id'),
    {
      schema: { body: updateCalendarEntryBody },
      preHandler: requirePermission('production.publish'),
    },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      const body = request.body as { scheduledFor?: string; status?: CalendarEntry['status'] };

      const patch: Record<string, unknown> = {};
      if (body.scheduledFor) {
        const when = new Date(body.scheduledFor);
        if (Number.isNaN(when.getTime())) {
          reply.code(400);
          return { error: 'bad_request', message: 'Fecha de programación inválida' };
        }
        patch.scheduled_for = when.toISOString();
      }
      if (body.status) patch.status = body.status;

      if (Object.keys(patch).length === 0) {
        reply.code(400);
        return { error: 'bad_request', message: 'No hay cambios que aplicar' };
      }

      try {
        const rows = await context.db.update<CalendarEntryRow>('calendar_entries', patch, {
          id: `eq.${id}`,
          church_id: `eq.${context.churchId}`,
        });
        const row = rows[0];
        if (!row) {
          reply.code(404);
          return { error: 'not_found', message: 'Programación no encontrada' };
        }
        return toCalendarEntry(row);
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.delete(
    route(prefix, '/church/calendar/:id'),
    { preHandler: requirePermission('production.publish') },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      try {
        await context.db.delete('calendar_entries', {
          id: `eq.${id}`,
          church_id: `eq.${context.churchId}`,
        });
        return { ok: true, id };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );
}
