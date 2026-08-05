import type { FastifyInstance } from 'fastify';
import {
  canTransitionProduction,
  isProductionStatus,
  PRODUCTION_STATUS_LABELS,
  PRODUCTION_STATUS_PERMISSION,
  roleCan,
  type Production,
  type ProductionStatus,
} from '@creator-ai-studio/shared';
import {
  handleChurchError,
  requireAnyPermission,
  requireChurchMember,
  requirePermission,
} from '../auth/rbac.js';
import {
  createCommentBody,
  createProductionBody,
  decideApprovalBody,
  updateProductionBody,
  updateProductionStatusBody,
} from '../http/church-schemas.js';
import {
  toApproval,
  toProduction,
  toProductionComment,
  type ApprovalRow,
  type ProductionCommentRow,
  type ProductionRow,
} from './mappers.js';

const PRODUCTION_SELECT = '*';

function route(prefix: string, path: string): string {
  return `${prefix}${path}`;
}

export function registerChurchProductionRoutes(app: FastifyInstance, prefix: '' | '/api'): void {
  app.get(
    route(prefix, '/church/productions'),
    { preHandler: requireChurchMember() },
    async (request, reply) => {
      const context = request.church!;
      const query = request.query as Record<string, string | undefined>;

      const params: Record<string, string | undefined> = {
        select: PRODUCTION_SELECT,
        church_id: `eq.${context.churchId}`,
        order: 'updated_at.desc',
        limit: String(Math.min(Number(query.limit ?? 200) || 200, 500)),
      };
      if (query.status && isProductionStatus(query.status)) params.status = `eq.${query.status}`;
      if (query.format) params.format = `eq.${query.format}`;
      if (query.ministryId) params.ministry_id = `eq.${query.ministryId}`;
      // `assignedTo=me` powers the "mis tareas" panel on the Hoy screen.
      if (query.assignedTo) {
        const userId = query.assignedTo === 'me' ? context.userId : query.assignedTo;
        params.assigned_to = `cs.{${userId}}`;
      }

      try {
        const rows = await context.db.select<ProductionRow>('productions', { params });
        return { items: rows.map(toProduction) satisfies Production[] };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.get(
    route(prefix, '/church/productions/:id'),
    { preHandler: requireChurchMember() },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      try {
        const row = await context.db.selectOne<ProductionRow>('productions', {
          params: {
            select: PRODUCTION_SELECT,
            id: `eq.${id}`,
            church_id: `eq.${context.churchId}`,
          },
        });
        if (!row) {
          reply.code(404);
          return { error: 'not_found', message: 'Producción no encontrada' };
        }

        const [comments, approvals] = await Promise.all([
          context.db.select<ProductionCommentRow>('production_comments', {
            params: { select: '*', production_id: `eq.${id}`, order: 'created_at.desc' },
          }),
          context.db.select<ApprovalRow>('production_approvals', {
            params: { select: '*', production_id: `eq.${id}`, order: 'created_at.desc' },
          }),
        ]);

        return {
          production: toProduction(row),
          comments: comments.map(toProductionComment),
          approvals: approvals.map(toApproval),
        };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.post(
    route(prefix, '/church/productions'),
    { schema: { body: createProductionBody }, preHandler: requirePermission('production.create') },
    async (request, reply) => {
      const context = request.church!;
      const body = request.body as Record<string, unknown>;
      try {
        const row = await context.db.insertOne<ProductionRow>('productions', {
          church_id: context.churchId,
          ministry_id: (body.ministryId as string) || null,
          title: String(body.title).trim(),
          format: body.format,
          status: 'idea',
          summary: (body.summary as string)?.trim() || null,
          service_date: (body.serviceDate as string)?.trim() || null,
          preacher: (body.preacher as string)?.trim() || null,
          bible_ref: (body.bibleRef as string)?.trim() || null,
          assigned_to: Array.isArray(body.assignedTo) ? body.assignedTo : [],
          source_asset_ids: Array.isArray(body.sourceAssetIds) ? body.sourceAssetIds : [],
          legacy_episode_id: (body.legacyEpisodeId as string)?.trim() || null,
          created_by: request.userId ?? null,
        });
        reply.code(201);
        return toProduction(row);
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.patch(
    route(prefix, '/church/productions/:id'),
    {
      schema: { body: updateProductionBody },
      // A disenador may attach artwork to a production without being able to
      // rewrite the script; the field-level filter below enforces the rest.
      preHandler: requireAnyPermission('production.edit_script', 'production.upload_art'),
    },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      const body = request.body as Record<string, unknown>;
      const canEditScript = roleCan(context.role, 'production.edit_script');

      if (!canEditScript && body.script !== undefined) {
        reply.code(403);
        return {
          error: 'forbidden',
          permission: 'production.edit_script',
          message: 'Tu rol no permite editar el guion de una producción.',
        };
      }

      try {
        const patch: Record<string, unknown> = {
          ...(body.sourceAssetIds !== undefined ? { source_asset_ids: body.sourceAssetIds } : {}),
        };

        if (canEditScript) {
          Object.assign(patch, {
            ...(body.title !== undefined ? { title: String(body.title).trim() } : {}),
            ...(body.ministryId !== undefined ? { ministry_id: body.ministryId || null } : {}),
            ...(body.summary !== undefined ? { summary: String(body.summary).trim() || null } : {}),
            ...(body.script !== undefined ? { script: String(body.script) } : {}),
            ...(body.serviceDate !== undefined
              ? { service_date: String(body.serviceDate).trim() || null }
              : {}),
            ...(body.preacher !== undefined
              ? { preacher: String(body.preacher).trim() || null }
              : {}),
            ...(body.bibleRef !== undefined
              ? { bible_ref: String(body.bibleRef).trim() || null }
              : {}),
            ...(body.assignedTo !== undefined ? { assigned_to: body.assignedTo } : {}),
          });
        }

        if (Object.keys(patch).length === 0) {
          reply.code(400);
          return { error: 'bad_request', message: 'No hay cambios que aplicar' };
        }

        const rows = await context.db.update<ProductionRow>('productions', patch, {
          id: `eq.${id}`,
          church_id: `eq.${context.churchId}`,
        });
        const row = rows[0];
        if (!row) {
          reply.code(404);
          return { error: 'not_found', message: 'Producción no encontrada' };
        }
        return toProduction(row);
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  /**
   * Status changes are where the workflow lives. Three rules, all enforced here
   * because only the server knows the previous status:
   *  1. the move must exist in PRODUCTION_STATUS_FLOW (no jumping to publicado),
   *  2. entering `aprobado` needs `production.approve`,
   *  3. entering `publicado` needs `production.publish` *and* a prior approval.
   */
  app.patch(
    route(prefix, '/church/productions/:id/status'),
    {
      schema: { body: updateProductionStatusBody },
      preHandler: requirePermission('production.edit_script'),
    },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      const { status, comment } = request.body as { status: ProductionStatus; comment?: string };

      try {
        const current = await context.db.selectOne<ProductionRow>('productions', {
          params: {
            select: PRODUCTION_SELECT,
            id: `eq.${id}`,
            church_id: `eq.${context.churchId}`,
          },
        });
        if (!current) {
          reply.code(404);
          return { error: 'not_found', message: 'Producción no encontrada' };
        }

        if (current.status === status) {
          return toProduction(current);
        }

        if (!canTransitionProduction(current.status, status)) {
          reply.code(409);
          return {
            error: 'invalid_transition',
            message: `No se puede pasar de ${PRODUCTION_STATUS_LABELS[current.status]} a ${PRODUCTION_STATUS_LABELS[status]}.`,
          };
        }

        const needed = PRODUCTION_STATUS_PERMISSION[status];
        if (needed && !roleCan(context.role, needed)) {
          reply.code(403);
          return {
            error: 'forbidden',
            permission: needed,
            role: context.role,
            message:
              status === 'aprobado'
                ? 'Solo un líder o administrador puede aprobar una producción.'
                : 'Solo un líder o administrador puede publicar.',
          };
        }

        if (status === 'publicado') {
          const approvals = await context.db.select<ApprovalRow>('production_approvals', {
            params: {
              select: 'id',
              production_id: `eq.${id}`,
              decision: 'eq.aprobado',
              limit: '1',
            },
          });
          if (approvals.length === 0) {
            reply.code(409);
            return {
              error: 'approval_required',
              message: 'Esta producción todavía no tiene una aprobación registrada.',
            };
          }
        }

        const rows = await context.db.update<ProductionRow>(
          'productions',
          {
            status,
            ...(status === 'publicado' ? { published_at: new Date().toISOString() } : {}),
          },
          { id: `eq.${id}`, church_id: `eq.${context.churchId}` },
        );
        const row = rows[0];
        if (!row) {
          reply.code(404);
          return { error: 'not_found', message: 'Producción no encontrada' };
        }

        // Moving into `revision` opens the approval request the líder acts on.
        if (status === 'revision') {
          await context.db.insert(
            'production_approvals',
            {
              church_id: context.churchId,
              production_id: id,
              requested_by: request.userId ?? null,
              comment: comment?.trim() || null,
            },
            { prefer: 'return=minimal' },
          );
        }

        return toProduction(row);
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.delete(
    route(prefix, '/church/productions/:id'),
    { preHandler: requirePermission('asset.delete') },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      try {
        await context.db.delete('productions', {
          id: `eq.${id}`,
          church_id: `eq.${context.churchId}`,
        });
        return { ok: true, id };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  // --- Comments -----------------------------------------------------------

  app.post(
    route(prefix, '/church/productions/:id/comments'),
    { schema: { body: createCommentBody }, preHandler: requirePermission('comment.write') },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      const { body } = request.body as { body: string };
      try {
        const row = await context.db.insertOne<ProductionCommentRow>('production_comments', {
          church_id: context.churchId,
          production_id: id,
          author_user_id: request.userId ?? null,
          body: body.trim(),
        });
        reply.code(201);
        return toProductionComment(row);
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  // --- Approvals ----------------------------------------------------------

  /** Pending approvals across the church — the líder's inbox. */
  app.get(
    route(prefix, '/church/approvals'),
    { preHandler: requireChurchMember() },
    async (request, reply) => {
      const context = request.church!;
      try {
        const rows = await context.db.select<ApprovalRow & { productions: ProductionRow | null }>(
          'production_approvals',
          {
            params: {
              select: '*,productions(*)',
              church_id: `eq.${context.churchId}`,
              decision: 'is.null',
              order: 'created_at.asc',
            },
          },
        );
        return {
          items: rows.map(row => ({
            approval: toApproval(row),
            production: row.productions ? toProduction(row.productions) : null,
          })),
        };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.post(
    route(prefix, '/church/approvals/:id/decide'),
    { schema: { body: decideApprovalBody }, preHandler: requirePermission('production.approve') },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      const { decision, comment } = request.body as {
        decision: 'aprobado' | 'cambios';
        comment?: string;
      };

      try {
        const rows = await context.db.update<ApprovalRow>(
          'production_approvals',
          {
            decision,
            comment: comment?.trim() || null,
            decided_by: request.userId ?? null,
            decided_at: new Date().toISOString(),
          },
          { id: `eq.${id}`, church_id: `eq.${context.churchId}` },
        );
        const approval = rows[0];
        if (!approval) {
          reply.code(404);
          return { error: 'not_found', message: 'Aprobación no encontrada' };
        }

        // The decision *is* the status change — no second click needed.
        const nextStatus: ProductionStatus = decision === 'aprobado' ? 'aprobado' : 'edicion';
        const updated = await context.db.update<ProductionRow>(
          'productions',
          { status: nextStatus },
          { id: `eq.${approval.production_id}`, church_id: `eq.${context.churchId}` },
        );

        return {
          approval: toApproval(approval),
          production: updated[0] ? toProduction(updated[0]) : null,
        };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );
}
