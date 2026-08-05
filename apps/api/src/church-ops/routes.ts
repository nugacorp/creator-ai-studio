import type { FastifyInstance } from 'fastify';
import type { LiveEvent, Production } from '@creator-ai-studio/shared';
import { handleChurchError, requireChurchMember } from '../auth/rbac.js';
import { registerChurchAssetRoutes } from './assets-routes.js';
import { registerChurchCalendarRoutes } from './calendar-routes.js';
import { registerChurchCoreRoutes } from './core-routes.js';
import { registerChurchLiveRoutes } from './live-routes.js';
import { registerChurchProductionRoutes } from './productions-routes.js';
import {
  toApproval,
  toCalendarEntry,
  toLiveEvent,
  toProduction,
  type ApprovalRow,
  type CalendarEntryRow,
  type LiveEventRow,
  type ProductionRow,
} from './mappers.js';

function route(prefix: string, path: string): string {
  return `${prefix}${path}`;
}

export function registerChurchRoutes(app: FastifyInstance, prefix: '' | '/api'): void {
  registerChurchCoreRoutes(app, prefix);
  registerChurchAssetRoutes(app, prefix);
  registerChurchProductionRoutes(app, prefix);
  registerChurchCalendarRoutes(app, prefix);
  registerChurchLiveRoutes(app, prefix);

  /**
   * Everything the "Hoy" screen shows, in one round trip: what is assigned to
   * me, what is waiting on someone, what goes out today, what is coming up.
   * One request keeps the landing screen fast on a phone in a church lobby.
   */
  app.get(
    route(prefix, '/church/today'),
    { preHandler: requireChurchMember() },
    async (request, reply) => {
      const context = request.church!;
      const now = new Date();
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      const inTwoWeeks = new Date(now.getTime() + 14 * 24 * 60 * 60 * 1000);

      try {
        const [mine, review, upcomingPublications, upcomingEvents, pendingApprovals] =
          await Promise.all([
            context.db.select<ProductionRow>('productions', {
              params: {
                select: '*',
                church_id: `eq.${context.churchId}`,
                assigned_to: `cs.{${context.userId}}`,
                status: 'neq.publicado',
                order: 'updated_at.desc',
                limit: '20',
              },
            }),
            context.db.select<ProductionRow>('productions', {
              params: {
                select: '*',
                church_id: `eq.${context.churchId}`,
                status: 'eq.revision',
                order: 'updated_at.asc',
                limit: '20',
              },
            }),
            context.db.select<CalendarEntryRow & { productions: ProductionRow | null }>(
              'calendar_entries',
              {
                params: {
                  select: '*,productions(*)',
                  church_id: `eq.${context.churchId}`,
                  status: 'eq.programado',
                  and: `(scheduled_for.gte.${startOfDay.toISOString()},scheduled_for.lte.${inTwoWeeks.toISOString()})`,
                  order: 'scheduled_for.asc',
                  limit: '20',
                },
              },
            ),
            context.db.select<LiveEventRow>('live_events', {
              params: {
                select: '*',
                church_id: `eq.${context.churchId}`,
                scheduled_at: `gte.${startOfDay.toISOString()}`,
                status: 'neq.finalizado',
                order: 'scheduled_at.asc',
                limit: '10',
              },
            }),
            context.db.select<ApprovalRow & { productions: ProductionRow | null }>(
              'production_approvals',
              {
                params: {
                  select: '*,productions(*)',
                  church_id: `eq.${context.churchId}`,
                  decision: 'is.null',
                  order: 'created_at.asc',
                  limit: '20',
                },
              },
            ),
          ]);

        return {
          church: context.church,
          role: context.role,
          assignedToMe: mine.map(toProduction) satisfies Production[],
          inReview: review.map(toProduction) satisfies Production[],
          upcomingPublications: upcomingPublications.map(row => ({
            entry: toCalendarEntry(row),
            production: row.productions ? toProduction(row.productions) : null,
          })),
          upcomingLiveEvents: upcomingEvents.map(toLiveEvent) satisfies LiveEvent[],
          pendingApprovals: pendingApprovals.map(row => ({
            approval: toApproval(row),
            production: row.productions ? toProduction(row.productions) : null,
          })),
        };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  /**
   * Ministry-level activity for the analytics screen (WO-5): how much each
   * ministry published and how long idea→publicación took, computed from the
   * rows themselves rather than a cached counter that can drift.
   */
  app.get(
    route(prefix, '/church/insights'),
    { preHandler: requireChurchMember() },
    async (request, reply) => {
      const context = request.church!;
      const query = request.query as { from?: string; to?: string };
      const from = query.from ?? new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString();
      const to = query.to ?? new Date().toISOString();

      try {
        const [productions, entries, ministries] = await Promise.all([
          context.db.select<ProductionRow>('productions', {
            params: {
              select: '*',
              church_id: `eq.${context.churchId}`,
              and: `(created_at.gte.${from},created_at.lte.${to})`,
              limit: '1000',
            },
          }),
          context.db.select<CalendarEntryRow>('calendar_entries', {
            params: {
              select: '*',
              church_id: `eq.${context.churchId}`,
              and: `(scheduled_for.gte.${from},scheduled_for.lte.${to})`,
              limit: '1000',
            },
          }),
          context.db.select<{ id: string; name: string }>('ministries', {
            params: { select: 'id,name', church_id: `eq.${context.churchId}` },
          }),
        ]);

        const ministryNames = new Map(ministries.map(m => [m.id, m.name]));
        const byMinistry = new Map<
          string,
          { ministryId: string | null; name: string; total: number; published: number }
        >();

        let leadTimeSum = 0;
        let leadTimeCount = 0;

        for (const row of productions) {
          const key = row.ministry_id ?? 'sin-ministerio';
          const bucket = byMinistry.get(key) ?? {
            ministryId: row.ministry_id,
            name: row.ministry_id ? ministryNames.get(row.ministry_id) ?? 'Ministerio' : 'Sin ministerio',
            total: 0,
            published: 0,
          };
          bucket.total += 1;
          if (row.status === 'publicado') {
            bucket.published += 1;
            if (row.published_at) {
              const days =
                (Date.parse(row.published_at) - Date.parse(row.created_at)) / (1000 * 60 * 60 * 24);
              if (Number.isFinite(days) && days >= 0) {
                leadTimeSum += days;
                leadTimeCount += 1;
              }
            }
          }
          byMinistry.set(key, bucket);
        }

        const scheduled = entries.length;
        const onTime = entries.filter(e => e.status === 'publicado').length;
        const failed = entries.filter(e => e.status === 'fallido').length;

        const byPlatformStatus = productions.reduce<Record<string, number>>((acc, row) => {
          acc[row.status] = (acc[row.status] ?? 0) + 1;
          return acc;
        }, {});

        return {
          range: { from, to },
          totals: {
            productions: productions.length,
            published: productions.filter(p => p.status === 'publicado').length,
            scheduled,
            failed,
          },
          byMinistry: [...byMinistry.values()].sort((a, b) => b.total - a.total),
          byStatus: byPlatformStatus,
          averageLeadTimeDays:
            leadTimeCount > 0 ? Number((leadTimeSum / leadTimeCount).toFixed(1)) : null,
          calendarCompliance:
            scheduled > 0 ? Number(((onTime / scheduled) * 100).toFixed(1)) : null,
        };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );
}
