import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { EpisodeSummary } from '@creator-ai-studio/shared';
import { buildApp } from '../src/app.js';
import {
  EPISODE_STAGE_DIRECTORIES,
  EpisodeStorage,
} from '../src/storage/index.js';

describe('api routes', () => {
  let storageDir: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'cas-episodes-'));
    app = buildApp({ storage: new EpisodeStorage(storageDir) });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  it('GET /health returns the service status', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'creator-ai-studio-api',
    });
  });

  it('GET /episodes returns an empty list when none exist', async () => {
    const response = await app.inject({ method: 'GET', url: '/episodes' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('POST /episodes creates an episode', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/episodes',
      payload: { title: 'Episodio de prueba' },
    });

    expect(response.statusCode).toBe(201);
    const episode = response.json() as EpisodeSummary;
    expect(episode).toMatchObject({
      title: 'Episodio de prueba',
      slug: 'episodio-de-prueba',
      status: 'draft',
    });
    expect(episode.id).toBeTruthy();
    expect(episode.createdAt).toBeTruthy();
    expect(episode.updatedAt).toBeTruthy();
  });

  it('GET /episodes returns the created episode', async () => {
    await app.inject({
      method: 'POST',
      url: '/episodes',
      payload: { title: 'Episodio de prueba' },
    });

    const response = await app.inject({ method: 'GET', url: '/episodes' });
    const episodes = response.json() as EpisodeSummary[];

    expect(response.statusCode).toBe(200);
    expect(episodes).toHaveLength(1);
    expect(episodes[0]?.title).toBe('Episodio de prueba');
  });

  it('POST /episodes creates the full stage folder structure on disk', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/episodes',
      payload: { title: 'Episodio de prueba' },
    });
    const episode = response.json() as EpisodeSummary;
    const episodeDir = path.join(
      storageDir,
      `${episode.id}-${episode.slug}`,
    );

    const expectedFiles = [
      'episode.json',
      '00-control/status.json',
      ...EPISODE_STAGE_DIRECTORIES.filter((stage) => stage !== '00-control').map(
        (stage) => `${stage}/.gitkeep`,
      ),
    ];

    for (const file of expectedFiles) {
      const stats = await stat(path.join(episodeDir, file));
      expect(stats.isFile()).toBe(true);
    }
  });

  it('POST /episodes rejects an empty title', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/episodes',
      payload: { title: '   ' },
    });

    expect(response.statusCode).toBe(400);
  });
});
