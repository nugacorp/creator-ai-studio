import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import type { ChurchPermission } from '@creator-ai-studio/shared';
import { requirePermissionForChurchMembers } from './rbac.js';

/**
 * Which permission each mutating route needs (WO-0).
 *
 * This lives in one table rather than sprinkled across forty handlers so the
 * whole authorization surface can be read — and audited — at once. A route that
 * mutates state and is missing from this table is a bug; `rbac.test.ts` asserts
 * every registered POST/PATCH/PUT/DELETE either matches a rule here or is
 * explicitly listed as unguarded.
 *
 * Church-native routes (`/church/*`) are absent on purpose: they declare their
 * own `requirePermission` preHandler, which has no legacy escape hatch.
 */

export interface RoutePermissionRule {
  methods: readonly string[];
  /** Matched against the pathname with any `/api` prefix already stripped. */
  pattern: RegExp;
  permission: ChurchPermission;
}

const MUTATING_METHODS = ['POST', 'PATCH', 'PUT', 'DELETE'] as const;
const WRITE = MUTATING_METHODS;

export const ROUTE_PERMISSIONS: readonly RoutePermissionRule[] = [
  // --- Episodes (the legacy face of a production) -------------------------
  { methods: ['DELETE'], pattern: /^\/episodes\/[^/]+$/, permission: 'asset.delete' },
  { methods: ['POST'], pattern: /^\/episodes$/, permission: 'production.create' },
  { methods: ['PATCH'], pattern: /^\/episodes\/[^/]+$/, permission: 'production.edit_script' },
  { methods: ['PATCH'], pattern: /^\/episodes\/[^/]+\/status$/, permission: 'production.edit_script' },
  {
    methods: ['PATCH'],
    pattern: /^\/episodes\/[^/]+\/stages\/[^/]+$/,
    permission: 'production.edit_script',
  },
  {
    methods: ['POST'],
    pattern: /^\/episodes\/[^/]+\/storyboard\/from-script$/,
    permission: 'production.edit_script',
  },

  // Art and thumbnails are exactly what a disenador is for.
  {
    methods: ['POST'],
    pattern: /^\/episodes\/[^/]+\/thumbnail$/,
    permission: 'production.upload_art',
  },
  {
    methods: ['POST'],
    pattern: /^\/episodes\/[^/]+\/scenes\/generate-images$/,
    permission: 'production.upload_art',
  },

  // Anything that burns CPU, GPU or provider credits is a render.
  { methods: ['POST'], pattern: /^\/episodes\/[^/]+\/render$/, permission: 'production.render' },
  { methods: ['POST'], pattern: /^\/episodes\/[^/]+\/shorts$/, permission: 'production.render' },
  {
    methods: ['POST'],
    pattern: /^\/episodes\/[^/]+\/subtitles\/generate$/,
    permission: 'production.render',
  },
  {
    methods: ['POST'],
    pattern: /^\/episodes\/[^/]+\/music\/generate$/,
    permission: 'production.render',
  },
  { methods: ['POST'], pattern: /^\/episodes\/[^/]+\/pipeline$/, permission: 'production.render' },
  {
    methods: ['POST'],
    pattern: /^\/episodes\/[^/]+\/run-safe-pipeline$/,
    permission: 'production.render',
  },
  { methods: ['POST'], pattern: /^\/episodes\/[^/]+\/archive$/, permission: 'production.render' },
  { methods: ['POST'], pattern: /^\/episodes\/[^/]+\/restore$/, permission: 'production.render' },
  { methods: ['POST'], pattern: /^\/episodes\/[^/]+\/jobs$/, permission: 'production.render' },
  { methods: ['PATCH'], pattern: /^\/jobs\/[^/]+$/, permission: 'production.render' },
  { methods: ['POST'], pattern: /^\/system\/auto-archive$/, permission: 'production.render' },

  // Publishing. The narrowest gate in the system.
  {
    methods: ['POST'],
    pattern: /^\/episodes\/[^/]+\/publish-package$/,
    permission: 'production.publish',
  },
  {
    methods: ['POST'],
    pattern: /^\/episodes\/[^/]+\/authorize-publish$/,
    permission: 'production.publish',
  },
  {
    methods: ['POST'],
    pattern: /^\/episodes\/[^/]+\/confirm-publish$/,
    permission: 'production.publish',
  },
  { methods: ['POST'], pattern: /^\/integrations\/youtube\/upload$/, permission: 'production.publish' },
  { methods: ['POST'], pattern: /^\/calendar\/events$/, permission: 'production.publish' },

  // --- Agents -------------------------------------------------------------
  {
    methods: ['POST'],
    pattern: /^\/episodes\/[^/]+\/agent-runs\/[^/]+\/approve$/,
    permission: 'production.approve',
  },
  {
    methods: ['POST'],
    pattern: /^\/episodes\/[^/]+\/agents\/[^/]+\/run$/,
    permission: 'production.render',
  },
  { methods: ['PATCH'], pattern: /^\/agents\/[^/]+\/overrides$/, permission: 'team.manage' },

  // --- Ideas --------------------------------------------------------------
  { methods: ['POST'], pattern: /^\/ideas$/, permission: 'production.create' },
  { methods: ['DELETE'], pattern: /^\/ideas\/[^/]+$/, permission: 'asset.delete' },
  { methods: ['POST'], pattern: /^\/ideas\/[^/]+\/brainstorm$/, permission: 'production.edit_script' },
  {
    methods: ['PATCH'],
    pattern: /^\/ideas\/[^/]+\/proposals\/[^/]+\/(approve|discard)$/,
    permission: 'production.create',
  },

  // --- Sunday post automation --------------------------------------------
  {
    methods: ['PATCH'],
    pattern: /^\/calendar\/sunday-service-post\/template$/,
    permission: 'production.edit_script',
  },
  {
    methods: ['POST'],
    pattern: /^\/calendar\/sunday-service-post\/(image|auto-run)$/,
    permission: 'production.upload_art',
  },

  // --- DAM (legacy digital-assets module) --------------------------------
  { methods: ['DELETE'], pattern: /^\/digital-assets\/[^/]+$/, permission: 'asset.delete' },
  { methods: ['POST', 'PATCH'], pattern: /^\/digital-assets(\/.*)?$/, permission: 'asset.upload' },

  // --- AI ------------------------------------------------------------------
  { methods: WRITE, pattern: /^\/(ai|gemini)\//, permission: 'production.edit_script' },
  { methods: ['POST'], pattern: /^\/copilot\/(chat|confirm)$/, permission: 'production.edit_script' },
  {
    methods: ['POST'],
    pattern: /^\/integrations\/elevenlabs\/tts$/,
    permission: 'production.render',
  },

  // --- Credentials and destinations ---------------------------------------
  { methods: WRITE, pattern: /^\/secrets(\/.*)?$/, permission: 'credentials.manage' },
  { methods: WRITE, pattern: /^\/channels(\/.*)?$/, permission: 'credentials.manage' },
  { methods: WRITE, pattern: /^\/oauth\//, permission: 'credentials.manage' },

  // --- Team ----------------------------------------------------------------
  { methods: WRITE, pattern: /^\/team(\/.*)?$/, permission: 'team.manage' },
];

/**
 * Mutating routes that deliberately carry no permission check.
 * Kept explicit so the coverage test can tell "allowed" from "forgotten".
 */
export const UNGUARDED_MUTATING_ROUTES: readonly RegExp[] = [
  // Per-user preferences (active channel, TTS voice). Nothing shared at stake.
  /^\/settings$/,
  // Church-native routes carry their own requirePermission preHandler.
  /^\/church(\/.*)?$/,
];

/** Strip the optional `/api` prefix so one rule covers both mounts. */
export function normalizePath(url: string): string {
  const pathname = url.split('?')[0] ?? '';
  return pathname.startsWith('/api') ? pathname.slice(4) || '/' : pathname;
}

export function findRule(method: string, pathname: string): RoutePermissionRule | undefined {
  return ROUTE_PERMISSIONS.find(
    rule => rule.methods.includes(method.toUpperCase()) && rule.pattern.test(pathname),
  );
}

export function isExplicitlyUnguarded(pathname: string): boolean {
  return UNGUARDED_MUTATING_ROUTES.some(pattern => pattern.test(pathname));
}

/**
 * Install the table as a single global preHandler. Runs after authentication
 * and before any route handler, so a denied caller never reaches the code that
 * would have made the change.
 */
export function registerRoutePermissions(app: FastifyInstance): void {
  const guards = new Map<ChurchPermission, ReturnType<typeof requirePermissionForChurchMembers>>();

  app.addHook('preHandler', async (request: FastifyRequest, reply: FastifyReply) => {
    if (!MUTATING_METHODS.includes(request.method.toUpperCase() as (typeof MUTATING_METHODS)[number])) {
      return;
    }

    const pathname = normalizePath(request.url);
    const rule = findRule(request.method, pathname);
    if (!rule) return;

    let guard = guards.get(rule.permission);
    if (!guard) {
      guard = requirePermissionForChurchMembers(rule.permission);
      guards.set(rule.permission, guard);
    }
    return guard.call(app, request, reply, () => undefined);
  });
}
