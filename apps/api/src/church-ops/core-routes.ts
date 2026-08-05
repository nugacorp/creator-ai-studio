import type { FastifyInstance } from 'fastify';
import {
  CHURCH_ROLE_LABELS,
  LEGACY_TEAM_ROLE_TO_CHURCH_ROLE,
  permissionsForRole,
  type Church,
  type ChurchMember,
  type ChurchRole,
  type Ministry,
} from '@creator-ai-studio/shared';
import { handleChurchError, requireChurchMember, requirePermission } from '../auth/rbac.js';
import {
  createChurchBody,
  createMinistryBody,
  updateChurchBody,
  updateMemberBody,
  updateMinistryBody,
  upsertMemberBody,
} from '../http/church-schemas.js';
import { getTeamResponse } from '../team/store.js';
import { getChurchSession } from './context.js';
import {
  toChurch,
  toChurchMember,
  toMinistry,
  type ChurchMemberRow,
  type ChurchRow,
  type MinistryRow,
} from './mappers.js';
import { isChurchDbConfigured, serviceClient, userClient } from './postgrest.js';

const MEMBER_SELECT = '*,profiles(display_name,email)';

function slugify(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}

function route(prefix: string, path: string): string {
  return `${prefix}${path}`;
}

export function registerChurchCoreRoutes(app: FastifyInstance, prefix: '' | '/api'): void {
  /**
   * Everything the web app needs to decide what to render: the active church,
   * the caller's role, and the exact permission list derived from the matrix.
   */
  app.get(route(prefix, '/church/me'), async (request, reply) => {
    if (!isChurchDbConfigured()) {
      return {
        configured: false,
        church: null,
        member: null,
        role: null,
        permissions: [],
        memberships: [],
      };
    }
    try {
      const session = await getChurchSession(request);
      return { configured: true, ...session };
    } catch (error) {
      return handleChurchError(reply, error);
    }
  });

  /** Reference data for the UI: role names and what each one may do. */
  app.get(route(prefix, '/church/roles'), async () => ({
    roles: (Object.keys(CHURCH_ROLE_LABELS) as ChurchRole[]).map(role => ({
      role,
      label: CHURCH_ROLE_LABELS[role],
      permissions: permissionsForRole(role),
    })),
  }));

  /**
   * Bootstrap. Creating a church makes the caller its admin (DB trigger), and
   * imports the legacy `team.json` roster so an existing workspace does not
   * start empty. owner→admin, editor→productor, viewer→voluntario.
   */
  app.post(
    route(prefix, '/church'),
    { schema: { body: createChurchBody } },
    async (request, reply) => {
      if (!request.userId || !request.accessToken) {
        reply.code(401);
        return { error: 'unauthorized', message: 'Se requiere una sesión de usuario' };
      }

      const body = request.body as {
        name: string;
        slug?: string;
        timezone?: string;
        locale?: string;
      };

      try {
        const db = userClient(request.accessToken);
        const church = toChurch(
          await db.insertOne<ChurchRow>('churches', {
            name: body.name.trim(),
            slug: body.slug?.trim() || slugify(body.name) || `iglesia-${Date.now()}`,
            ...(body.timezone ? { timezone: body.timezone } : {}),
            ...(body.locale ? { locale: body.locale } : {}),
            created_by_user_id: request.userId,
          }),
        );

        const imported = await importLegacyTeam(church.id, request.userId);

        reply.code(201);
        return { church, importedMembers: imported };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.patch(
    route(prefix, '/church'),
    { schema: { body: updateChurchBody }, preHandler: requirePermission('team.manage') },
    async (request, reply) => {
      const context = request.church!;
      const body = request.body as { name?: string; timezone?: string; locale?: string };
      try {
        const rows = await context.db.update<ChurchRow>(
          'churches',
          {
            ...(body.name ? { name: body.name.trim() } : {}),
            ...(body.timezone ? { timezone: body.timezone } : {}),
            ...(body.locale ? { locale: body.locale } : {}),
          },
          { id: `eq.${context.churchId}` },
        );
        const row = rows[0];
        if (!row) {
          reply.code(404);
          return { error: 'not_found', message: 'Iglesia no encontrada' };
        }
        return { church: toChurch(row) };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  // --- Ministries ---------------------------------------------------------

  app.get(
    route(prefix, '/church/ministries'),
    { preHandler: requireChurchMember() },
    async (request, reply) => {
      const context = request.church!;
      try {
        const rows = await context.db.select<MinistryRow>('ministries', {
          params: { select: '*', church_id: `eq.${context.churchId}`, order: 'name.asc' },
        });
        return { items: rows.map(toMinistry) satisfies Ministry[] };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.post(
    route(prefix, '/church/ministries'),
    { schema: { body: createMinistryBody }, preHandler: requirePermission('team.manage') },
    async (request, reply) => {
      const context = request.church!;
      const body = request.body as {
        name: string;
        slug?: string;
        description?: string;
        leadUserId?: string;
      };
      try {
        const row = await context.db.insertOne<MinistryRow>('ministries', {
          church_id: context.churchId,
          name: body.name.trim(),
          slug: body.slug?.trim() || slugify(body.name) || `ministerio-${Date.now()}`,
          description: body.description?.trim() || null,
          lead_user_id: body.leadUserId ?? null,
        });
        reply.code(201);
        return toMinistry(row);
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.patch(
    route(prefix, '/church/ministries/:id'),
    { schema: { body: updateMinistryBody }, preHandler: requirePermission('team.manage') },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      const body = request.body as {
        name?: string;
        description?: string;
        leadUserId?: string;
        isActive?: boolean;
      };
      try {
        const rows = await context.db.update<MinistryRow>(
          'ministries',
          {
            ...(body.name ? { name: body.name.trim() } : {}),
            ...(body.description !== undefined
              ? { description: body.description.trim() || null }
              : {}),
            ...(body.leadUserId !== undefined ? { lead_user_id: body.leadUserId || null } : {}),
            ...(body.isActive !== undefined ? { is_active: body.isActive } : {}),
          },
          { id: `eq.${id}`, church_id: `eq.${context.churchId}` },
        );
        const row = rows[0];
        if (!row) {
          reply.code(404);
          return { error: 'not_found', message: 'Ministerio no encontrado' };
        }
        return toMinistry(row);
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.delete(
    route(prefix, '/church/ministries/:id'),
    { preHandler: requirePermission('team.manage') },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      try {
        await context.db.delete('ministries', {
          id: `eq.${id}`,
          church_id: `eq.${context.churchId}`,
        });
        return { ok: true, id };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  // --- Team ---------------------------------------------------------------

  app.get(
    route(prefix, '/church/members'),
    { preHandler: requireChurchMember() },
    async (request, reply) => {
      const context = request.church!;
      try {
        const rows = await context.db.select<ChurchMemberRow>('church_members', {
          params: {
            select: MEMBER_SELECT,
            church_id: `eq.${context.churchId}`,
            order: 'created_at.asc',
          },
        });
        return { items: rows.map(toChurchMember) satisfies ChurchMember[] };
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  /**
   * Add a member by user id or by email. The email lookup needs to read another
   * user's profile, which RLS forbids — so it runs with service_role, gated by
   * the `team.manage` check that already ran in the preHandler.
   */
  app.post(
    route(prefix, '/church/members'),
    {
      schema: {
        body: {
          type: 'object',
          required: ['role'],
          properties: {
            ...upsertMemberBody.properties,
            userId: { type: 'string', format: 'uuid' },
            email: { type: 'string', maxLength: 320 },
          },
          additionalProperties: false,
        },
      },
      preHandler: requirePermission('team.manage'),
    },
    async (request, reply) => {
      const context = request.church!;
      const body = request.body as {
        userId?: string;
        email?: string;
        role: ChurchRole;
        title?: string;
        status?: ChurchMember['status'];
      };

      try {
        let userId = body.userId;
        if (!userId && body.email) {
          const admin = serviceClient();
          const profile = await admin.selectOne<{ id: string }>('profiles', {
            params: { select: 'id', email: `eq.${body.email.trim().toLowerCase()}` },
          });
          if (!profile) {
            reply.code(404);
            return {
              error: 'user_not_found',
              message: `No existe un usuario registrado con el correo ${body.email}. Pídele que cree su cuenta primero.`,
            };
          }
          userId = profile.id;
        }

        if (!userId) {
          reply.code(400);
          return { error: 'bad_request', message: 'Indica userId o email' };
        }

        const row = await context.db.insertOne<ChurchMemberRow>(
          'church_members',
          {
            church_id: context.churchId,
            user_id: userId,
            role: body.role,
            status: body.status ?? 'active',
            title: body.title?.trim() || null,
          },
          { prefer: 'return=representation,resolution=merge-duplicates' },
        );
        reply.code(201);
        return toChurchMember(row);
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.patch(
    route(prefix, '/church/members/:id'),
    { schema: { body: updateMemberBody }, preHandler: requirePermission('team.manage') },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      const body = request.body as {
        role?: ChurchRole;
        title?: string;
        status?: ChurchMember['status'];
      };

      try {
        const target = await context.db.selectOne<ChurchMemberRow>('church_members', {
          params: { select: '*', id: `eq.${id}`, church_id: `eq.${context.churchId}` },
        });
        if (!target) {
          reply.code(404);
          return { error: 'not_found', message: 'Integrante no encontrado' };
        }

        const losesAdmin = target.role === 'admin' && body.role && body.role !== 'admin';
        if (losesAdmin && (await countAdmins(context.db, context.churchId)) <= 1) {
          reply.code(409);
          return {
            error: 'last_admin',
            message: 'No puedes quitar el último administrador de la iglesia.',
          };
        }

        const rows = await context.db.update<ChurchMemberRow>(
          'church_members',
          {
            ...(body.role ? { role: body.role } : {}),
            ...(body.title !== undefined ? { title: body.title.trim() || null } : {}),
            ...(body.status ? { status: body.status } : {}),
          },
          { id: `eq.${id}`, church_id: `eq.${context.churchId}`, select: MEMBER_SELECT },
        );
        const row = rows[0];
        if (!row) {
          reply.code(404);
          return { error: 'not_found', message: 'Integrante no encontrado' };
        }
        return toChurchMember(row);
      } catch (error) {
        return handleChurchError(reply, error);
      }
    },
  );

  app.delete(
    route(prefix, '/church/members/:id'),
    { preHandler: requirePermission('team.manage') },
    async (request, reply) => {
      const context = request.church!;
      const { id } = request.params as { id: string };
      try {
        const target = await context.db.selectOne<ChurchMemberRow>('church_members', {
          params: { select: '*', id: `eq.${id}`, church_id: `eq.${context.churchId}` },
        });
        if (!target) {
          reply.code(404);
          return { error: 'not_found', message: 'Integrante no encontrado' };
        }
        if (target.role === 'admin' && (await countAdmins(context.db, context.churchId)) <= 1) {
          reply.code(409);
          return {
            error: 'last_admin',
            message: 'No puedes eliminar el último administrador de la iglesia.',
          };
        }
        await context.db.delete('church_members', {
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

async function countAdmins(
  db: ReturnType<typeof userClient>,
  churchId: string,
): Promise<number> {
  const rows = await db.select<{ id: string }>('church_members', {
    params: {
      select: 'id',
      church_id: `eq.${churchId}`,
      role: 'eq.admin',
      status: 'eq.active',
    },
  });
  return rows.length;
}

/**
 * Carry the existing `team.json` roster into the new church.
 * Best-effort: a workspace without a legacy team simply imports nothing.
 */
async function importLegacyTeam(churchId: string, creatorUserId: string): Promise<number> {
  let legacy;
  try {
    legacy = await getTeamResponse(creatorUserId);
  } catch {
    return 0;
  }

  const rows = legacy.members
    .filter(member => member.userId && member.userId !== creatorUserId)
    .map(member => ({
      church_id: churchId,
      user_id: member.userId as string,
      role: LEGACY_TEAM_ROLE_TO_CHURCH_ROLE[member.role] ?? 'voluntario',
      status: 'active',
      title: member.displayName || null,
    }));

  if (rows.length === 0) return 0;

  try {
    const admin = serviceClient();
    await admin.insert('church_members', rows, {
      prefer: 'return=minimal,resolution=ignore-duplicates',
    });
    return rows.length;
  } catch {
    return 0;
  }
}

export type { Church };
