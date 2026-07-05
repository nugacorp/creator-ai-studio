import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { EpisodeStorage } from '../src/storage/index.js';

describe('team routes', () => {
  let rootDir: string;
  let storageDir: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), 'cas-team-'));
    storageDir = path.join(rootDir, 'episodes');
    process.env.LOCAL_STORAGE_PATH = storageDir;
    app = buildApp({ storage: new EpisodeStorage(storageDir) });
    await app.ready();
  });

  afterEach(async () => {
    delete process.env.LOCAL_STORAGE_PATH;
    await app.close();
    await rm(rootDir, { recursive: true, force: true });
  });

  function teamFile(): string {
    return path.join(rootDir, 'settings', 'team.json');
  }

  it('GET /team returns an empty roster initially', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/team' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      members: [],
      invites: [],
      canManage: true,
    });
  });

  it('POST /team/sync-owner creates the owner member', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/team/sync-owner',
      payload: { email: 'owner@studio.test', displayName: 'Owner CAS' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { members: Array<{ role: string; email: string }> };
    expect(body.members).toHaveLength(1);
    expect(body.members[0]).toMatchObject({
      role: 'owner',
      email: 'owner@studio.test',
      displayName: 'Owner CAS',
    });

    const persisted = JSON.parse(await readFile(teamFile(), 'utf8')) as { members: unknown[] };
    expect(persisted.members).toHaveLength(1);
  });

  it('POST /team/invites stores a pending invite', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/team/sync-owner',
      payload: { email: 'owner@studio.test', displayName: 'Owner' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/team/invites',
      payload: { email: 'editor@studio.test', role: 'editor' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { invites: Array<{ email: string; role: string }> };
    expect(body.invites).toHaveLength(1);
    expect(body.invites[0]).toMatchObject({
      email: 'editor@studio.test',
      role: 'editor',
    });
  });

  it('rejects duplicate invites for the same email', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/team/sync-owner',
      payload: { email: 'owner@studio.test', displayName: 'Owner' },
    });

    await app.inject({
      method: 'POST',
      url: '/api/team/invites',
      payload: { email: 'editor@studio.test', role: 'editor' },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/team/invites',
      payload: { email: 'editor@studio.test', role: 'viewer' },
    });

    expect(response.statusCode).toBe(409);
  });

  it('DELETE /team/invites/:id revokes a pending invite', async () => {
    await app.inject({
      method: 'POST',
      url: '/api/team/sync-owner',
      payload: { email: 'owner@studio.test', displayName: 'Owner' },
    });

    const invited = await app.inject({
      method: 'POST',
      url: '/api/team/invites',
      payload: { email: 'editor@studio.test', role: 'editor' },
    });
    const inviteId = (invited.json() as { invites: Array<{ id: string }> }).invites[0].id;

    const response = await app.inject({
      method: 'DELETE',
      url: `/api/team/invites/${inviteId}`,
    });

    expect(response.statusCode).toBe(200);
    expect((response.json() as { invites: unknown[] }).invites).toHaveLength(0);
  });
});
