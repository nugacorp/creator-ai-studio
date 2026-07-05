import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { EpisodeSummary, ProductionJob } from '@creator-ai-studio/shared';
import { buildApp } from '../src/app.js';
import { EpisodeStorage } from '../src/storage/index.js';
import { areMocksAllowed } from '../src/config/mocks.js';
import { createProvider } from '../src/ai/router.js';
import { ProviderError } from '../src/ai/provider-error.js';

describe('FASE 3 — safe pipeline & publish package', () => {
  let storageDir: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'cas-phase3-'));
    // Jobs are stored next to the episodes dir; point both at the tmp dir.
    process.env.LOCAL_STORAGE_PATH = path.join(storageDir, 'episodes');
    app = buildApp({ storage: new EpisodeStorage(process.env.LOCAL_STORAGE_PATH) });
    await app.ready();
  });

  afterEach(async () => {
    delete process.env.LOCAL_STORAGE_PATH;
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  async function createEpisode(title: string): Promise<EpisodeSummary> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/episodes',
      payload: { title },
    });
    expect(response.statusCode).toBe(201);
    return response.json() as EpisodeSummary;
  }

  it('POST /episodes/:id/run-safe-pipeline creates a draft-mode pipeline job', async () => {
    const episode = await createEpisode('Episodio seguro');
    const response = await app.inject({
      method: 'POST',
      url: `/api/episodes/${episode.id}/run-safe-pipeline`,
      payload: {},
    });

    expect(response.statusCode).toBe(201);
    const job = response.json() as ProductionJob;
    expect(job.type).toBe('pipeline');
    expect(job.payload?.mode).toBe('production-draft');
  });

  it('POST /episodes/:id/run-safe-pipeline rejects publish-authorized mode', async () => {
    const episode = await createEpisode('Episodio protegido');
    const response = await app.inject({
      method: 'POST',
      url: `/api/episodes/${episode.id}/run-safe-pipeline`,
      payload: { mode: 'publish-authorized' },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'publish_not_allowed_here' });
  });

  it('legacy POST /episodes/:id/pipeline now defaults to draft mode', async () => {
    const episode = await createEpisode('Episodio legacy');
    const response = await app.inject({
      method: 'POST',
      url: `/api/episodes/${episode.id}/pipeline`,
    });

    expect(response.statusCode).toBe(201);
    const job = response.json() as ProductionJob;
    expect(job.payload?.mode).toBe('production-draft');
  });

  it('POST /episodes/:id/publish-package writes metadata.json and checklist.json', async () => {
    const episode = await createEpisode('Episodio empaquetado');

    // Give it some content so parts of the checklist pass.
    await app.inject({
      method: 'PATCH',
      url: `/api/episodes/${episode.id}`,
      payload: {
        content: {
          script: 'Guion de prueba',
          seoDescription: 'Descripción de prueba',
          seoTags: ['fe', 'reflexión'],
          seoTitles: ['Título SEO'],
        },
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: `/api/episodes/${episode.id}/publish-package`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      ok: boolean;
      ready: boolean;
      checklist: Array<{ key: string; ok: boolean }>;
    };
    expect(body.ok).toBe(true);
    // No audio/video/thumbnail yet — package exists but is not ready.
    expect(body.ready).toBe(false);

    const episodeDirs = (await import('node:fs/promises')).readdir;
    const dirs = await episodeDirs(process.env.LOCAL_STORAGE_PATH!);
    const workspace = dirs.find(d => d.includes(episode.id));
    expect(workspace).toBeDefined();

    const publishDir = path.join(process.env.LOCAL_STORAGE_PATH!, workspace!, '10-publish');
    expect(existsSync(path.join(publishDir, 'metadata.json'))).toBe(true);
    expect(existsSync(path.join(publishDir, 'checklist.json'))).toBe(true);

    const metadata = JSON.parse(await readFile(path.join(publishDir, 'metadata.json'), 'utf8'));
    expect(metadata.privacyStatus).toBe('private');
    expect(metadata.title).toBe('Título SEO');
  });

  it('POST /integrations/youtube/upload without authorize:true returns 403', async () => {
    const episode = await createEpisode('Episodio sin autorizar');
    const response = await app.inject({
      method: 'POST',
      url: '/api/integrations/youtube/upload',
      payload: { episodeId: episode.id },
    });

    expect(response.statusCode).toBe(403);
    expect(response.json()).toMatchObject({ error: 'publish_not_authorized' });
  });
});

describe('FASE 8 — mocks blocked in production', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env.NODE_ENV = originalEnv.NODE_ENV;
    process.env.ALLOW_MOCKS = originalEnv.ALLOW_MOCKS;
    process.env.AI_ALLOW_DEMO_FALLBACK = originalEnv.AI_ALLOW_DEMO_FALLBACK;
    if (originalEnv.ALLOW_MOCKS === undefined) delete process.env.ALLOW_MOCKS;
    if (originalEnv.AI_ALLOW_DEMO_FALLBACK === undefined)
      delete process.env.AI_ALLOW_DEMO_FALLBACK;
  });

  it('areMocksAllowed() is false in production by default', () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_MOCKS;
    expect(areMocksAllowed()).toBe(false);
  });

  it('ALLOW_MOCKS=false blocks mocks in any environment', () => {
    process.env.NODE_ENV = 'test';
    process.env.ALLOW_MOCKS = 'false';
    expect(areMocksAllowed()).toBe(false);
  });

  it('demo provider cannot be created when mocks are blocked, even with demo fallback on', async () => {
    process.env.NODE_ENV = 'production';
    delete process.env.ALLOW_MOCKS;
    process.env.AI_ALLOW_DEMO_FALLBACK = 'true';

    await expect(createProvider('demo')).rejects.toBeInstanceOf(ProviderError);
  });

  it('demo provider works in dev/test', async () => {
    process.env.NODE_ENV = 'test';
    delete process.env.ALLOW_MOCKS;
    const provider = await createProvider('demo');
    expect(provider.name).toBe('demo');
  });
});
