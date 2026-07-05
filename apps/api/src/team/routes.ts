import type { FastifyInstance } from 'fastify';
import type { TeamRole } from '@creator-ai-studio/shared';
import { isTeamRole } from '@creator-ai-studio/shared';
import {
  createTeamInviteBody,
  syncTeamOwnerBody,
  updateTeamMemberBody,
} from '../http/schemas.js';
import {
  createTeamInvite,
  getTeamResponse,
  removeTeamMember,
  revokeTeamInvite,
  syncTeamOwner,
  TeamStoreError,
  updateTeamMemberRole,
} from './store.js';

function route(prefix: string, path: string): string {
  return `${prefix}${path}`;
}

function teamErrorStatus(code: TeamStoreError['code']): number {
  switch (code) {
    case 'forbidden':
      return 403;
    case 'not_found':
      return 404;
    case 'duplicate':
    case 'invalid_email':
      return 409;
    default:
      return 400;
  }
}

export function registerTeamRoutes(app: FastifyInstance, prefix: '' | '/api'): void {
  app.get(route(prefix, '/team'), async request => {
    return getTeamResponse(request.userId);
  });

  app.post(
    route(prefix, '/team/sync-owner'),
    { schema: { body: syncTeamOwnerBody } },
    async (request, reply) => {
      const body = (request.body ?? {}) as { email?: string; displayName?: string };
      try {
        return await syncTeamOwner(
          {
            email: body.email ?? '',
            displayName: body.displayName ?? '',
          },
          request.userId,
        );
      } catch (err) {
        if (err instanceof TeamStoreError) {
          reply.code(teamErrorStatus(err.code));
          return { error: err.code, message: err.message };
        }
        throw err;
      }
    },
  );

  app.post(
    route(prefix, '/team/invites'),
    { schema: { body: createTeamInviteBody } },
    async (request, reply) => {
      const body = (request.body ?? {}) as { email?: string; role?: string };
      const role = body.role;
      if (role !== 'editor' && role !== 'viewer') {
        reply.code(400);
        return { error: 'invalid_role', message: 'Rol inválido' };
      }
      try {
        return await createTeamInvite(
          { email: body.email ?? '', role },
          request.userId,
        );
      } catch (err) {
        if (err instanceof TeamStoreError) {
          reply.code(teamErrorStatus(err.code));
          return { error: err.code, message: err.message };
        }
        throw err;
      }
    },
  );

  app.patch(
    route(prefix, '/team/members/:id'),
    { schema: { body: updateTeamMemberBody } },
    async (request, reply) => {
      const { id } = request.params as { id: string };
      const body = (request.body ?? {}) as { role?: string };
      if (!isTeamRole(body.role) || body.role === 'owner') {
        reply.code(400);
        return { error: 'invalid_role', message: 'Rol inválido' };
      }
      try {
        return await updateTeamMemberRole(id, body.role as TeamRole, request.userId);
      } catch (err) {
        if (err instanceof TeamStoreError) {
          reply.code(teamErrorStatus(err.code));
          return { error: err.code, message: err.message };
        }
        throw err;
      }
    },
  );

  app.delete(route(prefix, '/team/members/:id'), async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await removeTeamMember(id, request.userId);
    } catch (err) {
      if (err instanceof TeamStoreError) {
        reply.code(teamErrorStatus(err.code));
        return { error: err.code, message: err.message };
      }
      throw err;
    }
  });

  app.delete(route(prefix, '/team/invites/:id'), async (request, reply) => {
    const { id } = request.params as { id: string };
    try {
      return await revokeTeamInvite(id, request.userId);
    } catch (err) {
      if (err instanceof TeamStoreError) {
        reply.code(teamErrorStatus(err.code));
        return { error: err.code, message: err.message };
      }
      throw err;
    }
  });
}
