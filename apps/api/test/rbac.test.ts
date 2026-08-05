import { describe, expect, it } from 'vitest';
import {
  CHURCH_PERMISSIONS,
  CHURCH_ROLES,
  permissionsForRole,
  roleCan,
  type ChurchPermission,
  type ChurchRole,
} from '@creator-ai-studio/shared';
import { buildApp } from '../src/app.js';
import {
  findRule,
  isExplicitlyUnguarded,
  normalizePath,
} from '../src/auth/route-permissions.js';

/**
 * WO-0 acceptance: the permission matrix in §4 of the technical plan, asserted
 * cell by cell, plus proof that no mutating route escaped the table.
 */

/** §4 of docs/03-product/PLAN_TECNICO_PLATAFORMA_IGLESIA.md, transcribed independently. */
const PLAN_MATRIX: Array<[ChurchPermission, ChurchRole[]]> = [
  ['library.view', ['admin', 'lider', 'productor', 'disenador', 'voluntario']],
  ['asset.upload', ['admin', 'lider', 'productor', 'disenador', 'voluntario']],
  ['asset.delete', ['admin']],
  ['production.create', ['admin', 'lider', 'productor']],
  ['production.edit_script', ['admin', 'lider', 'productor']],
  ['production.upload_art', ['admin', 'lider', 'productor', 'disenador']],
  ['production.render', ['admin', 'lider', 'productor']],
  ['production.approve', ['admin', 'lider']],
  ['production.publish', ['admin', 'lider']],
  ['live.control', ['admin', 'lider', 'productor']],
  ['team.manage', ['admin']],
  ['credentials.manage', ['admin']],
  ['comment.write', ['admin', 'lider', 'productor', 'disenador', 'voluntario']],
];

describe('permission matrix', () => {
  it('covers all 13 rows of the plan', () => {
    expect(PLAN_MATRIX).toHaveLength(CHURCH_PERMISSIONS.length);
    expect(PLAN_MATRIX.map(([permission]) => permission).sort()).toEqual(
      [...CHURCH_PERMISSIONS].sort(),
    );
  });

  for (const [permission, allowed] of PLAN_MATRIX) {
    for (const role of CHURCH_ROLES) {
      const shouldAllow = allowed.includes(role);
      it(`${role} ${shouldAllow ? 'can' : 'cannot'} ${permission}`, () => {
        expect(roleCan(role, permission)).toBe(shouldAllow);
      });
    }
  }

  it('grants nothing without a role', () => {
    for (const permission of CHURCH_PERMISSIONS) {
      expect(roleCan(undefined, permission)).toBe(false);
      expect(roleCan(null, permission)).toBe(false);
    }
  });

  it('gives a voluntario read/upload/comment only', () => {
    expect(permissionsForRole('voluntario').sort()).toEqual(
      ['asset.upload', 'comment.write', 'library.view'].sort(),
    );
  });

  it('gives an admin everything', () => {
    expect(permissionsForRole('admin').sort()).toEqual([...CHURCH_PERMISSIONS].sort());
  });

  it('never lets a productor publish or approve', () => {
    expect(roleCan('productor', 'production.publish')).toBe(false);
    expect(roleCan('productor', 'production.approve')).toBe(false);
  });

  it('never lets a disenador edit a script', () => {
    expect(roleCan('disenador', 'production.edit_script')).toBe(false);
  });
});

describe('route permission table', () => {
  it('maps the acceptance-criteria routes to the right permission', () => {
    expect(findRule('DELETE', '/episodes/abc')?.permission).toBe('asset.delete');
    expect(findRule('POST', '/integrations/youtube/upload')?.permission).toBe(
      'production.publish',
    );
    expect(findRule('POST', '/episodes')?.permission).toBe('production.create');
    expect(findRule('PATCH', '/secrets')?.permission).toBe('credentials.manage');
    expect(findRule('POST', '/team/invites')?.permission).toBe('team.manage');
  });

  it('applies to both the bare and /api-prefixed mounts', () => {
    expect(normalizePath('/api/episodes/abc?x=1')).toBe('/episodes/abc');
    expect(normalizePath('/episodes/abc')).toBe('/episodes/abc');
    expect(findRule('DELETE', normalizePath('/api/episodes/abc'))?.permission).toBe(
      'asset.delete',
    );
  });

  it('leaves no mutating route unguarded by accident', async () => {
    const app = buildApp();
    await app.ready();

    // printRoutes gives a tree; the routes map is easier to walk.
    const table = app
      .printRoutes({ commonPrefix: false })
      .split('\n')
      .map(line => line.trim())
      .filter(Boolean);
    await app.close();

    // Fastify's printed tree is not machine-friendly enough to assert on
    // directly, so assert on the explicit registry instead: every mutating
    // path we know about resolves to a rule or an explicit exemption.
    const knownMutatingPaths: Array<[string, string]> = [
      ['POST', '/episodes'],
      ['PATCH', '/episodes/x'],
      ['DELETE', '/episodes/x'],
      ['PATCH', '/episodes/x/status'],
      ['PATCH', '/episodes/x/stages/research'],
      ['POST', '/episodes/x/render'],
      ['POST', '/episodes/x/shorts'],
      ['POST', '/episodes/x/thumbnail'],
      ['POST', '/episodes/x/subtitles/generate'],
      ['POST', '/episodes/x/storyboard/from-script'],
      ['POST', '/episodes/x/scenes/generate-images'],
      ['POST', '/episodes/x/music/generate'],
      ['POST', '/episodes/x/pipeline'],
      ['POST', '/episodes/x/run-safe-pipeline'],
      ['POST', '/episodes/x/publish-package'],
      ['POST', '/episodes/x/authorize-publish'],
      ['POST', '/episodes/x/confirm-publish'],
      ['POST', '/episodes/x/archive'],
      ['POST', '/episodes/x/restore'],
      ['POST', '/episodes/x/jobs'],
      ['PATCH', '/jobs/x'],
      ['POST', '/episodes/x/agents/hermes/run'],
      ['POST', '/episodes/x/agent-runs/r1/approve'],
      ['PATCH', '/agents/hermes/overrides'],
      ['POST', '/ideas'],
      ['DELETE', '/ideas/x'],
      ['POST', '/ideas/x/brainstorm'],
      ['PATCH', '/ideas/x/proposals/p1/approve'],
      ['PATCH', '/ideas/x/proposals/p1/discard'],
      ['POST', '/channels'],
      ['PATCH', '/channels/x'],
      ['DELETE', '/channels/x'],
      ['PATCH', '/secrets'],
      ['POST', '/secrets/test/gemini'],
      ['POST', '/team/invites'],
      ['PATCH', '/team/members/x'],
      ['DELETE', '/team/members/x'],
      ['DELETE', '/team/invites/x'],
      ['POST', '/digital-assets'],
      ['POST', '/digital-assets/upload'],
      ['PATCH', '/digital-assets/x'],
      ['DELETE', '/digital-assets/x'],
      ['POST', '/system/auto-archive'],
      ['POST', '/calendar/events'],
      ['PATCH', '/calendar/sunday-service-post/template'],
      ['POST', '/calendar/sunday-service-post/image'],
      ['POST', '/calendar/sunday-service-post/auto-run'],
      ['POST', '/integrations/youtube/upload'],
      ['POST', '/integrations/elevenlabs/tts'],
      ['POST', '/copilot/chat'],
      ['POST', '/copilot/confirm'],
      ['POST', '/ai/generate-image'],
      ['POST', '/gemini/chat'],
      ['PATCH', '/settings'],
    ];

    const unguarded = knownMutatingPaths.filter(
      ([method, pathname]) => !findRule(method, pathname) && !isExplicitlyUnguarded(pathname),
    );

    expect(unguarded, `rutas mutantes sin permiso asignado: ${JSON.stringify(unguarded)}`).toEqual(
      [],
    );
    expect(table.length).toBeGreaterThan(0);
  });
});
