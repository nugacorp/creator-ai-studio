import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { EpisodeSummary } from '@creator-ai-studio/shared';
import { buildApp } from '../src/app.js';
import { EpisodeStorage } from '../src/storage/index.js';

describe('calendar events', () => {
  let storageDir: string;
  let app: FastifyInstance;
  let previousDataPath: string | undefined;

  beforeEach(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'cas-calendar-'));
    previousDataPath = process.env.CAS_DATA_PATH;
    process.env.CAS_DATA_PATH = storageDir;
    app = buildApp({ storage: new EpisodeStorage(storageDir) });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
    if (previousDataPath === undefined) {
      delete process.env.CAS_DATA_PATH;
    } else {
      process.env.CAS_DATA_PATH = previousDataPath;
    }
  });

  async function createEpisode(title: string): Promise<EpisodeSummary> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/episodes',
      payload: { title },
    });
    return response.json() as EpisodeSummary;
  }

  function nextSundayIsoAt(hour = 10): string {
    const now = new Date();
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, 0, 0));
    const delta = (7 - d.getUTCDay()) % 7;
    d.setUTCDate(d.getUTCDate() + delta);
    return d.toISOString();
  }

  it('GET /api/calendar/events returns episodes with scheduledAt in review', async () => {
    const episode = await createEpisode('Lanzamiento programado');

    await app.inject({
      method: 'PATCH',
      url: `/api/episodes/${episode.id}`,
      payload: {
        status: 'review',
        content: { scheduledAt: '2026-08-15T18:00:00.000Z' },
      },
    });

    const response = await app.inject({ method: 'GET', url: '/api/calendar/events' });
    expect(response.statusCode).toBe(200);

    const events = response.json() as Array<{
      id: string;
      title: string;
      date: string;
      status: string;
      source: string;
      scheduledAt?: string;
    }>;

    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      id: `ep_${episode.id}`,
      title: 'Lanzamiento programado',
      date: '2026-08-15',
      status: 'scheduled',
      source: 'local',
      scheduledAt: '2026-08-15T18:00:00.000Z',
    });
  });

  it('GET /api/calendar/events includes published episodes', async () => {
    const episode = await createEpisode('Ya publicado');

    await app.inject({
      method: 'PATCH',
      url: `/api/episodes/${episode.id}`,
      payload: { status: 'published' },
    });

    const response = await app.inject({ method: 'GET', url: '/api/calendar/events' });
    const events = response.json() as Array<{ status: string; title: string }>;

    expect(events.some(e => e.title === 'Ya publicado' && e.status === 'published')).toBe(true);
  });

  it('GET /api/calendar/events omits draft episodes without schedule', async () => {
    await createEpisode('Borrador sin fecha');

    const response = await app.inject({ method: 'GET', url: '/api/calendar/events' });
    const events = response.json() as unknown[];

    expect(events).toEqual([]);
  });

  it('POST /api/calendar/events sets scheduledAt on episode', async () => {
    const episode = await createEpisode('Desde calendario');

    const response = await app.inject({
      method: 'POST',
      url: '/api/calendar/events',
      payload: { episodeId: episode.id, date: '2026-09-01' },
    });

    expect(response.statusCode).toBe(201);

    const detail = await app.inject({ method: 'GET', url: `/api/episodes/${episode.id}` });
    const body = detail.json() as { content: { scheduledAt?: string }; status: string };
    expect(body.status).toBe('review');
    expect(body.content.scheduledAt).toBe('2026-09-01T18:00:00Z');
  });

  it('GET /api/calendar/sunday-service-post builds friday post from next sunday event', async () => {
    const saturdayEpisode = await createEpisode('Servicio Sabado');
    const sundayEpisode = await createEpisode('Servicio Dominical Especial');

    await app.inject({
      method: 'PATCH',
      url: `/api/episodes/${saturdayEpisode.id}`,
      payload: {
        status: 'review',
        content: { scheduledAt: '2026-08-08T18:00:00.000Z' },
      },
    });

    await app.inject({
      method: 'PATCH',
      url: `/api/episodes/${sundayEpisode.id}`,
      payload: {
        status: 'review',
        content: { scheduledAt: '2026-08-09T10:00:00.000Z' },
      },
    });

    const response = await app.inject({ method: 'GET', url: '/api/calendar/sunday-service-post' });
    expect(response.statusCode).toBe(200);

    const body = response.json() as {
      foundSundayEvent: boolean;
      sundayDate?: string;
      message: string;
      event?: { title: string; time: string };
    };

    expect(body.foundSundayEvent).toBe(true);
    expect(body.sundayDate).toBe('2026-08-09');
    expect(body.event?.title).toBe('Servicio Dominical Especial');
    expect(body.event?.time).toBe('10:00');
    expect(body.message).toContain('Servicio Dominical Especial');
  });

  it('GET /api/calendar/sunday-service-post returns fallback when no sunday event exists', async () => {
    const episode = await createEpisode('Solo entre semana');

    await app.inject({
      method: 'PATCH',
      url: `/api/episodes/${episode.id}`,
      payload: {
        status: 'review',
        content: { scheduledAt: '2026-08-10T18:00:00.000Z' },
      },
    });

    const response = await app.inject({ method: 'GET', url: '/api/calendar/sunday-service-post' });
    expect(response.statusCode).toBe(200);

    const body = response.json() as { foundSundayEvent: boolean; message: string };
    expect(body.foundSundayEvent).toBe(false);
    expect(body.message).toContain('servicio de este domingo');
  });

  it('POST /api/calendar/sunday-service-post/image returns image for friday post', async () => {
    const sundayEpisode = await createEpisode('Servicio de Gratitud');
    await app.inject({
      method: 'PATCH',
      url: `/api/episodes/${sundayEpisode.id}`,
      payload: {
        status: 'review',
        content: { scheduledAt: '2026-08-09T10:00:00.000Z' },
      },
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/calendar/sunday-service-post/image',
    });
    expect(response.statusCode).toBe(200);

    const body = response.json() as {
      imageUrl: string;
      prompt: string;
      post: { foundSundayEvent: boolean; event?: { title: string } };
    };

    expect(body.imageUrl).toBeTruthy();
    expect(body.prompt).toContain('Christian Sunday service invitation');
    if (body.post.foundSundayEvent) {
      expect(body.post.event?.title).toBe('Servicio de Gratitud');
    }
  });

  it('POST /api/calendar/sunday-service-post/auto-run stores artifact and GET latest returns it', async () => {
    const sundayEpisode = await createEpisode('Servicio Familiar Domingo');
    const sundayIso = nextSundayIsoAt(9);
    await app.inject({
      method: 'PATCH',
      url: `/api/episodes/${sundayEpisode.id}`,
      payload: {
        status: 'review',
        content: { scheduledAt: sundayIso },
      },
    });

    const autoRun = await app.inject({
      method: 'POST',
      url: '/api/calendar/sunday-service-post/auto-run',
      payload: { force: true },
    });

    expect(autoRun.statusCode).toBe(200);
    const autoBody = autoRun.json() as {
      created: boolean;
      artifact?: { post?: { foundSundayEvent?: boolean; event?: { title?: string }; message?: string }; imageUrl?: string };
    };
    expect(autoBody.created).toBe(true);
    expect(autoBody.artifact?.imageUrl).toBeTruthy();
    expect(autoBody.artifact?.post?.message?.length ?? 0).toBeGreaterThan(20);

    const latest = await app.inject({ method: 'GET', url: '/api/calendar/sunday-service-post/latest' });
    expect(latest.statusCode).toBe(200);
    const latestBody = latest.json() as {
      artifact?: { post?: { message?: string }; imageUrl?: string };
    };
    expect(latestBody.artifact?.imageUrl).toBeTruthy();
    expect(latestBody.artifact?.post?.message?.length ?? 0).toBeGreaterThan(20);
  });

  it('POST /api/calendar/sunday-service-post/auto-run skips duplicate friday generation', async () => {
    const sundayEpisode = await createEpisode('Servicio Dominical Unico');
    const sundayIso = nextSundayIsoAt(11);
    await app.inject({
      method: 'PATCH',
      url: `/api/episodes/${sundayEpisode.id}`,
      payload: {
        status: 'review',
        content: { scheduledAt: sundayIso },
      },
    });

    const first = await app.inject({
      method: 'POST',
      url: '/api/calendar/sunday-service-post/auto-run',
      payload: { force: true },
    });
    expect(first.statusCode).toBe(200);

    const second = await app.inject({
      method: 'POST',
      url: '/api/calendar/sunday-service-post/auto-run',
      payload: { force: false },
    });
    expect(second.statusCode).toBe(200);
    const secondBody = second.json() as { created: boolean; skipped: boolean; reason?: string };
    expect(secondBody.created).toBe(false);
    expect(secondBody.skipped).toBe(true);
    expect(secondBody.reason).toBe('already_generated_for_friday');
  });
});
