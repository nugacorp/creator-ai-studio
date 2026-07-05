import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm, writeFile, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { EpisodeStorage } from '../src/storage/index.js';
import {
  arePromptsSimilar,
  generateEpisodeMusic,
  hasBackgroundMusic,
  musicFilePath,
} from '../src/media/music.js';

describe('music prompt similarity', () => {
  it('treats identical prompts as similar', () => {
    const p = 'Orquestal dramática para historia bíblica épica';
    expect(arePromptsSimilar(p, p)).toBe(true);
  });

  it('treats overlapping prompts as similar', () => {
    const a = 'Música instrumental ambiente suave piano cuerdas documental cristiano';
    const b = 'Música instrumental ambiente suave piano cuerdas esperanza';
    expect(arePromptsSimilar(a, b)).toBe(true);
  });

  it('rejects unrelated prompts', () => {
    expect(arePromptsSimilar('metal industrial agresivo', 'piano clásico suave')).toBe(false);
  });
});

describe('episode music generation', () => {
  let storageDir: string;
  let app: FastifyInstance;
  let storage: EpisodeStorage;

  beforeEach(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'cas-music-'));
    process.env.AI_ALLOW_DEMO_FALLBACK = 'true';
    process.env.ALLOW_MOCKS = 'true';
    storage = new EpisodeStorage(storageDir);
    app = buildApp({ storage });
    await app.ready();
  });

  afterEach(async () => {
    delete process.env.AI_ALLOW_DEMO_FALLBACK;
    delete process.env.ALLOW_MOCKS;
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  it('POST /episodes/:id/music/generate saves background music in demo mode', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/episodes',
      payload: { title: 'Música test' },
    });
    const episode = created.json() as { id: string };
    const dir = await storage.getEpisodeDirectory(episode.id);
    expect(dir).toBeTruthy();

    const response = await app.inject({
      method: 'POST',
      url: `/api/episodes/${episode.id}/music/generate`,
      payload: {
        prompt: 'Piano ambiental suave para reflexión espiritual',
        model: 'lyria-3-clip-preview',
      },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { musicUrl: string; saved: boolean; label: string };
    expect(body.saved).toBe(true);
    expect(body.musicUrl).toContain('/files/music');

    expect(hasBackgroundMusic(dir!)).toBe(true);
    const meta = JSON.parse(
      await readFile(path.join(dir!, '05-audio', 'music-meta.json'), 'utf8'),
    ) as { prompt: string };
    expect(meta.prompt).toContain('Piano ambiental');

    const detail = await storage.getEpisode(episode.id);
    expect(detail?.content.musicUrl).toBeTruthy();
  });

  it('skips regeneration when force:false and prompt is similar', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/episodes',
      payload: { title: 'Reuse music' },
    });
    const episode = created.json() as { id: string };
    const dir = (await storage.getEpisodeDirectory(episode.id))!;

    const first = await generateEpisodeMusic(episode.id, dir, {
      prompt: 'Cuerdas etéreas documental bíblico esperanza',
      title: 'Reuse music',
    });
    expect(first.skipped).toBeFalsy();

    const second = await app.inject({
      method: 'POST',
      url: `/api/episodes/${episode.id}/music/generate`,
      payload: {
        prompt: 'Cuerdas etéreas documental bíblico esperanza y paz',
      },
    });
    const body = second.json() as { skipped?: boolean };
    expect(body.skipped).toBe(true);
  });

  it('force:true regenerates even with similar prompt', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/episodes',
      payload: { title: 'Force music' },
    });
    const episode = created.json() as { id: string };
    const dir = (await storage.getEpisodeDirectory(episode.id))!;

    await generateEpisodeMusic(episode.id, dir, {
      prompt: 'Guitarra acústica pastoral',
      title: 'Force music',
    });

    await writeFile(musicFilePath(dir), Buffer.from('placeholder-old-track'));

    const response = await app.inject({
      method: 'POST',
      url: `/api/episodes/${episode.id}/music/generate`,
      payload: { prompt: 'Guitarra acústica pastoral suave', force: true },
    });
    expect(response.statusCode).toBe(200);
    const after = await readFile(musicFilePath(dir));
    expect(after.toString()).not.toBe('placeholder-old-track');
  });
});
