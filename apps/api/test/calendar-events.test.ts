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

  beforeEach(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'cas-calendar-'));
    app = buildApp({ storage: new EpisodeStorage(storageDir) });
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  async function createEpisode(title: string): Promise<EpisodeSummary> {
    const response = await app.inject({
      method: 'POST',
      url: '/api/episodes',
      payload: { title },
    });
    return response.json() as EpisodeSummary;
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
});
