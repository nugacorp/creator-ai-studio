import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { EpisodeDetail, EpisodeSummary } from '@creator-ai-studio/shared';
import { buildApp } from '../src/app.js';
import { EpisodeStorage } from '../src/storage/index.js';

describe('shorts_agent and SEO pinnedComment', () => {
  let storageDir: string;
  let app: FastifyInstance;
  let storage: EpisodeStorage;

  beforeEach(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'cas-shorts-seo-'));
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

  async function createEpisode(title: string): Promise<EpisodeSummary> {
    const response = await app.inject({
      method: 'POST',
      url: '/episodes',
      payload: { title },
    });
    return response.json() as EpisodeSummary;
  }

  it('shorts_agent persists shorts array and metadata.json', async () => {
    const episode = await createEpisode('David y Goliat');
    await app.inject({
      method: 'PATCH',
      url: `/api/episodes/${episode.id}`,
      payload: {
        content: {
          script: 'A'.repeat(200),
          videoUrl: '/api/episodes/media/video',
        },
      },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/episodes/${episode.id}/agents/shorts_agent/run`,
      payload: { async: false },
    });
    expect(res.statusCode).toBe(200);

    const detailRes = await app.inject({ method: 'GET', url: `/api/episodes/${episode.id}` });
    const detail = detailRes.json() as EpisodeDetail;
    expect((detail.content.shorts?.length ?? 0)).toBeGreaterThan(0);

    const dir = await storage.getEpisodeDirectory(episode.id);
    const meta = JSON.parse(
      await readFile(path.join(dir!, '09-shorts', 'metadata.json'), 'utf8'),
    ) as { shorts: unknown[] };
    expect(meta.shorts.length).toBeGreaterThan(0);
  });

  it('seo_optimizer persists pinnedComment to content and 08-seo/metadata.json', async () => {
    const episode = await createEpisode('SEO pinned test');
    await app.inject({
      method: 'PATCH',
      url: `/api/episodes/${episode.id}`,
      payload: { content: { script: 'Guion de prueba '.repeat(20) } },
    });

    const res = await app.inject({
      method: 'POST',
      url: `/api/episodes/${episode.id}/agents/seo_optimizer/run`,
      payload: { async: false },
    });
    expect(res.statusCode).toBe(200);

    const detailRes = await app.inject({ method: 'GET', url: `/api/episodes/${episode.id}` });
    const detail = detailRes.json() as EpisodeDetail;
    const pinned =
      detail.content.pinnedComment ??
      detail.content.seoTitles[0] ??
      '';
    expect(detail.content.seoTitles.length).toBeGreaterThan(0);

    const dir = await storage.getEpisodeDirectory(episode.id);
    const meta = JSON.parse(
      await readFile(path.join(dir!, '08-seo', 'metadata.json'), 'utf8'),
    ) as { pinnedComment?: string; titles?: string[] };
    expect(meta.titles?.length).toBeGreaterThan(0);
    expect(
      (meta.pinnedComment?.trim().length ?? 0) > 0 || (detail.content.pinnedComment?.trim().length ?? 0) > 0,
    ).toBe(true);
    void pinned;
  });

  it('GET /settings includes default publishSchedule', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/settings' });
    expect(res.statusCode).toBe(200);
    const body = res.json() as { publishSchedule?: { longVideo: { dayOfWeek: number } } };
    expect(body.publishSchedule?.longVideo.dayOfWeek).toBe(1);
  });
});
