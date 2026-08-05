import type { FastifyRequest } from 'fastify';
import {
  permissionsForRole,
  type Church,
  type ChurchMember,
  type ChurchRole,
  type ChurchSession,
} from '@creator-ai-studio/shared';
import {
  ChurchDbError,
  isChurchDbConfigured,
  userClient,
  type ChurchDbClient,
} from './postgrest.js';
import {
  toChurch,
  toChurchMember,
  type ChurchMemberRow,
  type ChurchRow,
} from './mappers.js';

/**
 * Resolves *which church* a request acts on and *what role* the caller has
 * there. Every church-ops route starts here; the RBAC preHandler consumes it.
 */

export interface ChurchContext {
  db: ChurchDbClient;
  userId: string;
  churchId: string;
  church: Church;
  member: ChurchMember;
  role: ChurchRole;
}

declare module 'fastify' {
  interface FastifyRequest {
    church?: ChurchContext;
  }
}

/** Per-request memo. Two preHandlers on the same route must not query twice. */
const CONTEXT_CACHE = new WeakMap<FastifyRequest, Promise<ChurchContext>>();

export class ChurchAccessError extends ChurchDbError {}

function requireToken(request: FastifyRequest): string {
  if (!request.accessToken || !request.userId) {
    throw new ChurchAccessError(401, 'Se requiere una sesión de usuario');
  }
  return request.accessToken;
}

/**
 * The church a request targets: explicit `churchId` (body, params or query)
 * when given, otherwise the caller's only membership. With one church per
 * deployment the implicit path is what the UI actually uses.
 */
function requestedChurchId(request: FastifyRequest): string | undefined {
  const params = (request.params ?? {}) as Record<string, unknown>;
  const query = (request.query ?? {}) as Record<string, unknown>;
  const body = (request.body ?? {}) as Record<string, unknown>;
  const candidate = params.churchId ?? query.churchId ?? body.churchId;
  return typeof candidate === 'string' && candidate.trim() ? candidate.trim() : undefined;
}

async function loadMemberships(
  db: ChurchDbClient,
  userId: string,
): Promise<Array<{ member: ChurchMember; church: Church }>> {
  const rows = await db.select<ChurchMemberRow & { churches: ChurchRow | null }>('church_members', {
    params: {
      select: '*,churches(*)',
      user_id: `eq.${userId}`,
      status: 'eq.active',
      order: 'created_at.asc',
    },
  });

  return rows
    .filter((row): row is ChurchMemberRow & { churches: ChurchRow } => row.churches !== null)
    .map(row => ({ member: toChurchMember(row), church: toChurch(row.churches) }));
}

async function buildContext(request: FastifyRequest): Promise<ChurchContext> {
  if (!isChurchDbConfigured()) {
    throw new ChurchDbError(
      503,
      'La plataforma de iglesia requiere Supabase configurado (SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY).',
    );
  }

  const token = requireToken(request);
  const userId = request.userId as string;
  const db = userClient(token);

  const memberships = await loadMemberships(db, userId);
  if (memberships.length === 0) {
    throw new ChurchAccessError(
      403,
      'Tu usuario todavía no pertenece a ninguna iglesia. Pide a un administrador que te invite.',
    );
  }

  const wanted = requestedChurchId(request);
  const selected = wanted
    ? memberships.find(entry => entry.church.id === wanted)
    : memberships[0];

  if (!selected) {
    throw new ChurchAccessError(403, 'No tienes acceso a esa iglesia');
  }

  return {
    db,
    userId,
    churchId: selected.church.id,
    church: selected.church,
    member: selected.member,
    role: selected.member.role,
  };
}

/** Resolve (and cache) the church context for this request. */
export async function getChurchContext(request: FastifyRequest): Promise<ChurchContext> {
  const cached = CONTEXT_CACHE.get(request);
  if (cached) return cached;

  const pending = buildContext(request).then(context => {
    request.church = context;
    return context;
  });
  CONTEXT_CACHE.set(request, pending);

  try {
    return await pending;
  } catch (error) {
    // Do not cache failures: a later route may legitimately not need a church.
    CONTEXT_CACHE.delete(request);
    throw error;
  }
}

/** Full session payload for `GET /api/church/me`. */
export async function getChurchSession(request: FastifyRequest): Promise<ChurchSession> {
  const token = requireToken(request);
  const userId = request.userId as string;
  const db = userClient(token);
  const memberships = await loadMemberships(db, userId);

  const wanted = requestedChurchId(request);
  const selected = wanted
    ? memberships.find(entry => entry.church.id === wanted) ?? null
    : memberships[0] ?? null;

  return {
    church: selected?.church ?? null,
    member: selected?.member ?? null,
    role: selected?.member.role ?? null,
    permissions: selected ? permissionsForRole(selected.member.role) : [],
    memberships: memberships.map(entry => ({ church: entry.church, role: entry.member.role })),
  };
}
