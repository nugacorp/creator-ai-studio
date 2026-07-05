import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import {
  EPISODE_STAGES,
  type EpisodeDetail,
  type EpisodeStageState,
  type EpisodeSummary,
} from '@creator-ai-studio/shared';
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
    process.env.AI_ALLOW_DEMO_FALLBACK = 'true';
    app = buildApp({ storage: new EpisodeStorage(storageDir) });
    await app.ready();
  });

  afterEach(async () => {
    delete process.env.AI_ALLOW_DEMO_FALLBACK;
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
  });

  async function createEpisode(
    title: string,
    basePath = '',
  ): Promise<EpisodeSummary> {
    const response = await app.inject({
      method: 'POST',
      url: `${basePath}/episodes`,
      payload: { title },
    });
    return response.json() as EpisodeSummary;
  }

  it('GET /health returns the service status', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({
      status: 'ok',
      service: 'creator-ai-studio-api',
    });
  });

  it('GET /episodes returns an empty list when none exist', async () => {
    const response = await app.inject({ method: 'GET', url: '/episodes' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });

  it('GET /api/episodes returns an empty list when none exist', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/episodes' });

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

  it('POST /api/episodes creates an episode', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/episodes',
      payload: { title: 'Episodio API' },
    });

    expect(response.statusCode).toBe(201);
    const episode = response.json() as EpisodeSummary;
    expect(episode).toMatchObject({
      title: 'Episodio API',
      slug: 'episodio-api',
      status: 'draft',
    });
  });

  it('GET /episodes returns the created episode', async () => {
    await createEpisode('Episodio de prueba');

    const response = await app.inject({ method: 'GET', url: '/episodes' });
    const episodes = response.json() as EpisodeSummary[];

    expect(response.statusCode).toBe(200);
    expect(episodes).toHaveLength(1);
    expect(episodes[0]?.title).toBe('Episodio de prueba');
  });

  it('POST /episodes creates the full stage folder structure on disk', async () => {
    const episode = await createEpisode('Episodio de prueba');
    const episodeDir = path.join(storageDir, `${episode.id}-${episode.slug}`);

    const expectedFiles = [
      'episode.json',
      '00-control/status.json',
      '00-control/stages.json',
      ...EPISODE_STAGE_DIRECTORIES.filter((stage) => stage !== '00-control').map(
        (stage) => `${stage}/.gitkeep`,
      ),
    ];

    for (const file of expectedFiles) {
      const stats = await stat(path.join(episodeDir, file));
      expect(stats.isFile()).toBe(true);
    }
  });

  it('POST /episodes writes stages.json with planning completed and the rest pending', async () => {
    const episode = await createEpisode('Episodio de prueba');
    const stagesFile = path.join(
      storageDir,
      `${episode.id}-${episode.slug}`,
      '00-control',
      'stages.json',
    );

    const stages = JSON.parse(
      await readFile(stagesFile, 'utf8'),
    ) as EpisodeStageState[];

    expect(stages).toHaveLength(EPISODE_STAGES.length);
    expect(stages.find((stage) => stage.stage === 'planning')?.status).toBe(
      'completed',
    );
    const others = stages.filter((stage) => stage.stage !== 'planning');
    expect(others.every((stage) => stage.status === 'pending')).toBe(true);
  });

  it('GET /episodes/:id returns the episode detail with stages', async () => {
    const episode = await createEpisode('Episodio de prueba');

    const response = await app.inject({
      method: 'GET',
      url: `/episodes/${episode.id}`,
    });

    expect(response.statusCode).toBe(200);
    const detail = response.json() as EpisodeDetail;
    expect(detail.id).toBe(episode.id);
    expect(detail.workspacePath).toBe(`${episode.id}-${episode.slug}`);
    expect(detail.stages).toHaveLength(EPISODE_STAGES.length);
    expect(detail.stages[0]?.stage).toBe('planning');
    expect(detail.stages[0]?.status).toBe('completed');
  });

  it('GET /api/episodes/:id returns the episode detail with stages', async () => {
    const episode = await createEpisode('Episodio API', '/api');

    const response = await app.inject({
      method: 'GET',
      url: `/api/episodes/${episode.id}`,
    });

    expect(response.statusCode).toBe(200);
    const detail = response.json() as EpisodeDetail;
    expect(detail.id).toBe(episode.id);
    expect(detail.workspacePath).toBe(`${episode.id}-${episode.slug}`);
    expect(detail.stages).toHaveLength(EPISODE_STAGES.length);
  });

  it('GET /episodes/:id/assets lists downloadable files for the workspace', async () => {
    const episode = await createEpisode('Episodio assets');

    const response = await app.inject({
      method: 'GET',
      url: `/episodes/${episode.id}/assets`,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      workspacePath: string;
      storageLocation: string;
      files: { key: string; available: boolean }[];
    };
    expect(body.workspacePath).toBe(`${episode.id}-${episode.slug}`);
    expect(body.storageLocation).toBe('local');
    expect(body.files.some(f => f.key === 'video')).toBe(true);
    expect(body.files.some(f => f.key === 'script' && f.available === false)).toBe(true);
  });

  it('GET /episodes/:id returns 404 for a missing episode', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/episodes/does-not-exist',
    });

    expect(response.statusCode).toBe(404);
  });

  it('DELETE /episodes/:id removes the episode workspace', async () => {
    const episode = await createEpisode('Episodio a borrar');

    const del = await app.inject({
      method: 'DELETE',
      url: `/episodes/${episode.id}`,
    });
    expect(del.statusCode).toBe(200);
    expect((del.json() as { ok: boolean }).ok).toBe(true);

    const gone = await app.inject({
      method: 'GET',
      url: `/episodes/${episode.id}`,
    });
    expect(gone.statusCode).toBe(404);

    const list = await app.inject({ method: 'GET', url: '/episodes' });
    const episodes = list.json() as EpisodeSummary[];
    expect(episodes.some(e => e.id === episode.id)).toBe(false);
  });

  it('POST /episodes rejects an empty title', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/episodes',
      payload: { title: '   ' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('PATCH /episodes/:id/stages/:stage moves a stage to in_progress', async () => {
    const episode = await createEpisode('Episodio de prueba');

    const response = await app.inject({
      method: 'PATCH',
      url: `/episodes/${episode.id}/stages/research`,
      payload: { status: 'in_progress' },
    });

    expect(response.statusCode).toBe(200);
    const detail = response.json() as EpisodeDetail;
    expect(
      detail.stages.find((stage) => stage.stage === 'research')?.status,
    ).toBe('in_progress');
  });

  it('PATCH /api/episodes/:id/stages/:stage moves a stage to in_progress', async () => {
    const episode = await createEpisode('Episodio API', '/api');

    const response = await app.inject({
      method: 'PATCH',
      url: `/api/episodes/${episode.id}/stages/research`,
      payload: { status: 'in_progress' },
    });

    expect(response.statusCode).toBe(200);
    const detail = response.json() as EpisodeDetail;
    expect(
      detail.stages.find((stage) => stage.stage === 'research')?.status,
    ).toBe('in_progress');
  });

  it('PATCH /episodes/:id/stages/:stage moves a stage to completed', async () => {
    const episode = await createEpisode('Episodio de prueba');

    const response = await app.inject({
      method: 'PATCH',
      url: `/episodes/${episode.id}/stages/script`,
      payload: { status: 'completed' },
    });

    expect(response.statusCode).toBe(200);
    const detail = response.json() as EpisodeDetail;
    expect(
      detail.stages.find((stage) => stage.stage === 'script')?.status,
    ).toBe('completed');
  });

  it('PATCH /episodes/:id/stages/:stage returns 404 for a missing episode', async () => {
    const response = await app.inject({
      method: 'PATCH',
      url: '/episodes/does-not-exist/stages/research',
      payload: { status: 'in_progress' },
    });

    expect(response.statusCode).toBe(404);
  });

  it('PATCH /episodes/:id/stages/:stage rejects an invalid stage', async () => {
    const episode = await createEpisode('Episodio de prueba');

    const response = await app.inject({
      method: 'PATCH',
      url: `/episodes/${episode.id}/stages/not-a-stage`,
      payload: { status: 'in_progress' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('PATCH /episodes/:id/stages/:stage rejects an invalid status', async () => {
    const episode = await createEpisode('Episodio de prueba');

    const response = await app.inject({
      method: 'PATCH',
      url: `/episodes/${episode.id}/stages/research`,
      payload: { status: 'frozen' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('PATCH /episodes/:id updates episode content', async () => {
    const episode = await createEpisode('Contenido test');

    const response = await app.inject({
      method: 'PATCH',
      url: `/episodes/${episode.id}`,
      payload: {
        content: { script: 'Guion de prueba', series: 'Reflexiones' },
      },
    });

    expect(response.statusCode).toBe(200);
    const detail = response.json() as EpisodeDetail;
    expect(detail.content.script).toBe('Guion de prueba');
    expect(detail.content.series).toBe('Reflexiones');
  });

  it('POST /api/gemini/chat returns a reply in demo mode', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/gemini/chat',
      payload: { message: 'Hola copiloto' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { reply: string };
    expect(body.reply).toBeTruthy();
  });

  it('POST /api/gemini/chat refuses out-of-scope general questions', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/gemini/chat',
      payload: { message: 'cuanto es 4++4?' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { reply: string; out_of_scope?: boolean };
    expect(body.out_of_scope).toBe(true);
    expect(body.reply).toContain('Creator AI Studio');
    expect(body.reply).toContain('no puedo responder');
    expect(body.reply).not.toContain('8');
  });

  it('POST /api/gemini/chat refuses math even with episode context prefix', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/gemini/chat',
      payload: {
        message: '[Contexto: episodio activo "David vs Goliat"] cuanto es 4+9?',
      },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { reply: string; out_of_scope?: boolean };
    expect(body.out_of_scope).toBe(true);
    expect(body.reply).toContain('no puedo responder');
    expect(body.reply).not.toContain('13');
  });

  it('POST /api/episodes/:id/jobs creates a production job', async () => {
    const episode = await createEpisode('Job test');

    const response = await app.inject({
      method: 'POST',
      url: `/api/episodes/${episode.id}/jobs`,
      payload: { type: 'render' },
    });

    expect(response.statusCode).toBe(201);
    const job = response.json() as { id: string; status: string };
    expect(job.status).toBe('pending');
    expect(job.id).toBeTruthy();
  });
});
