import type { FastifyReply, FastifyRequest, preHandlerHookHandler } from 'fastify';
import {
  CHURCH_ROLE_LABELS,
  roleCan,
  type ChurchPermission,
  type ChurchRole,
} from '@creator-ai-studio/shared';
import { ChurchDbError } from '../church-ops/postgrest.js';
import { getChurchContext } from '../church-ops/context.js';

/**
 * Role enforcement (WO-0).
 *
 * Authentication answers "who are you"; this answers "may you". It runs as a
 * Fastify preHandler *before* the route body, so a denied caller never reaches
 * the code that would have done the damage. Hiding the button in the web app is
 * a courtesy, not a control (AD-4).
 */

const PERMISSION_MESSAGES: Record<ChurchPermission, string> = {
  'library.view': 'ver la biblioteca',
  'asset.upload': 'subir material',
  'asset.delete': 'eliminar material',
  'production.create': 'crear producciones',
  'production.edit_script': 'editar producciones',
  'production.upload_art': 'subir arte y miniaturas',
  'production.render': 'lanzar renders',
  'production.approve': 'aprobar producciones',
  'production.publish': 'publicar',
  'live.control': 'controlar la transmisión',
  'team.manage': 'gestionar el equipo',
  'credentials.manage': 'ver o editar credenciales',
  'comment.write': 'comentar',
};

function denial(role: ChurchRole, permission: ChurchPermission): string {
  return `Tu rol (${CHURCH_ROLE_LABELS[role]}) no permite ${PERMISSION_MESSAGES[permission]}.`;
}

function sendChurchError(reply: FastifyReply, error: unknown): FastifyReply {
  if (error instanceof ChurchDbError) {
    return reply.code(error.status).send({
      error: error.status === 403 ? 'forbidden' : 'church_error',
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    });
  }
  throw error;
}

/**
 * Require a permission from the church permission matrix.
 * Resolves the caller's church context first (cached per request).
 */
export function requirePermission(permission: ChurchPermission): preHandlerHookHandler {
  return async function permissionGuard(request: FastifyRequest, reply: FastifyReply) {
    let context;
    try {
      context = await getChurchContext(request);
    } catch (error) {
      return sendChurchError(reply, error);
    }

    if (!roleCan(context.role, permission)) {
      request.log.warn(
        { userId: context.userId, churchId: context.churchId, role: context.role, permission },
        'permission denied',
      );
      return reply.code(403).send({
        error: 'forbidden',
        permission,
        role: context.role,
        message: denial(context.role, permission),
      });
    }
  };
}

/**
 * Require *any* of several permissions. Used where one route serves two roles,
 * e.g. uploading a thumbnail is `production.upload_art` for a disenador but
 * `production.edit_script` work for a productor.
 */
export function requireAnyPermission(
  ...permissions: ChurchPermission[]
): preHandlerHookHandler {
  return async function anyPermissionGuard(request: FastifyRequest, reply: FastifyReply) {
    let context;
    try {
      context = await getChurchContext(request);
    } catch (error) {
      return sendChurchError(reply, error);
    }

    if (permissions.some(permission => roleCan(context.role, permission))) return;

    const first = permissions[0] as ChurchPermission;
    request.log.warn(
      { userId: context.userId, churchId: context.churchId, role: context.role, permissions },
      'permission denied',
    );
    return reply.code(403).send({
      error: 'forbidden',
      permission: first,
      role: context.role,
      message: denial(context.role, first),
    });
  };
}

/**
 * Same check as `requirePermission`, but a caller who belongs to no church at
 * all passes through.
 *
 * This is the bridge for the pre-church routes (episodes, jobs, secrets, team).
 * Those already isolate data by `userId`, so a lone operator with no church
 * keeps working exactly as before; the moment a church exists and the caller is
 * a member of it, the matrix applies in full. Church-native routes never use
 * this — they use `requirePermission`, which has no such escape hatch.
 */
export function requirePermissionForChurchMembers(
  permission: ChurchPermission,
): preHandlerHookHandler {
  return async function legacyPermissionGuard(request: FastifyRequest, reply: FastifyReply) {
    // No user id means the caller authenticated with the static API key: the
    // production worker calling back into the API. That is a server credential,
    // not a person, and it has no role to check.
    if (!request.userId) return;

    let context;
    try {
      context = await getChurchContext(request);
    } catch (error) {
      // 403 here means "no membership" — legacy single-user mode, allow.
      // Anything else (401, 503) is a real failure the caller must see.
      if (error instanceof ChurchDbError && error.status === 403) return;
      if (error instanceof ChurchDbError && error.status === 503) return;
      return sendChurchError(reply, error);
    }

    if (!roleCan(context.role, permission)) {
      request.log.warn(
        { userId: context.userId, churchId: context.churchId, role: context.role, permission },
        'permission denied',
      );
      return reply.code(403).send({
        error: 'forbidden',
        permission,
        role: context.role,
        message: denial(context.role, permission),
      });
    }
  };
}

/**
 * Membership only — no specific permission. For read routes that any member of
 * the church may call.
 */
export function requireChurchMember(): preHandlerHookHandler {
  return async function memberGuard(request: FastifyRequest, reply: FastifyReply) {
    try {
      await getChurchContext(request);
    } catch (error) {
      return sendChurchError(reply, error);
    }
  };
}

/**
 * Translate a thrown ChurchDbError into an HTTP reply inside a route handler.
 * Routes use this so an RLS denial surfaces as 403 with a readable message
 * instead of a generic 500.
 */
export function handleChurchError(reply: FastifyReply, error: unknown): unknown {
  if (error instanceof ChurchDbError) {
    reply.code(error.status);
    return {
      error: error.status === 403 ? 'forbidden' : 'church_error',
      message: error.message,
      ...(error.details ? { details: error.details } : {}),
    };
  }
  throw error;
}
