import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { EpisodeStorage } from '../src/storage/index.js';

describe('auth', () => {
  let storageDir: string;
  let app: FastifyInstance;
  const envSnapshot: Record<string, string | undefined> = {};

  function saveEnv(keys: string[]): void {
    for (const key of keys) {
      envSnapshot[key] = process.env[key];
    }
  }

  function restoreEnv(keys: string[]): void {
    for (const key of keys) {
      const value = envSnapshot[key];
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  }

  async function buildAuthedApp(): Promise<FastifyInstance> {
    storageDir = await mkdtemp(path.join(tmpdir(), 'cas-auth-'));
    const instance = buildApp({ storage: new EpisodeStorage(storageDir) });
    await instance.ready();
    return instance;
  }

  beforeEach(() => {
    saveEnv(['CAS_API_KEY', 'SUPABASE_URL', 'SUPABASE_JWT_SECRET', 'NODE_ENV']);
  });

  afterEach(async () => {
    restoreEnv(['CAS_API_KEY', 'SUPABASE_URL', 'SUPABASE_JWT_SECRET', 'NODE_ENV']);
    if (app) {
      await app.close();
    }
    if (storageDir) {
      await rm(storageDir, { recursive: true, force: true });
    }
  });

  it('GET /api/auth/status is public and reports auth flags', async () => {
    process.env.CAS_API_KEY = 'test-api-key';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    app = await buildAuthedApp();

    const response = await app.inject({ method: 'GET', url: '/api/auth/status' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      authRequired: true,
      apiKeyAuth: true,
      supabaseAuth: true,
    });
  });

  it('GET /api/system/mode is public without credentials', async () => {
    process.env.CAS_API_KEY = 'test-api-key';
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    app = await buildAuthedApp();

    const response = await app.inject({ method: 'GET', url: '/api/system/mode' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      demoMode: expect.any(Boolean),
      aiProvider: expect.any(String),
    });
  });

  it('returns 401 unauthorized when auth is required and no credentials are sent', async () => {
    process.env.CAS_API_KEY = 'test-api-key';
    app = await buildAuthedApp();

    const response = await app.inject({ method: 'GET', url: '/api/episodes' });

    expect(response.statusCode).toBe(401);
    expect(response.json()).toEqual({ error: 'unauthorized' });
  });

  it('accepts CAS_API_KEY as Bearer token', async () => {
    process.env.CAS_API_KEY = 'test-api-key';
    app = await buildAuthedApp();

    const response = await app.inject({
      method: 'GET',
      url: '/api/episodes',
      headers: { authorization: 'Bearer test-api-key' },
    });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });
});
