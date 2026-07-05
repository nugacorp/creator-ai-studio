import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { EpisodeStorage } from '../src/storage/index.js';

describe('ideas workspace API', () => {
  let storageDir: string;
  let app: FastifyInstance;
  let storage: EpisodeStorage;

  beforeEach(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'cas-ideas-'));
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

  it('POST /ideas creates a draft idea', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/ideas',
      payload: {
        rawIdea: 'La perseverancia de Job',
        audience: 'Adultos',
        passage: 'Job 1:21',
      },
    });
    expect(response.statusCode).toBe(201);
    const idea = response.json() as { id: string; rawIdea: string; status: string };
    expect(idea.rawIdea).toBe('La perseverancia de Job');
    expect(idea.status).toBe('draft');
  });

  it('POST /ideas/:id/brainstorm generates proposals', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/ideas',
      payload: { rawIdea: 'Daniel en el foso' },
    });
    const idea = created.json() as { id: string };

    const response = await app.inject({
      method: 'POST',
      url: `/api/ideas/${idea.id}/brainstorm`,
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as {
      idea: { status: string; proposals: { title: string; points: string[]; status: string }[] };
    };
    expect(body.idea.status).toBe('brainstormed');
    expect(body.idea.proposals.length).toBeGreaterThanOrEqual(3);
    expect(body.idea.proposals[0].points.length).toBeGreaterThanOrEqual(3);
    expect(body.idea.proposals[0].status).toBe('pending');
  });

  it('PATCH approve creates episode, brief, and enqueues researcher', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/ideas',
      payload: { rawIdea: 'David vs Goliat' },
    });
    const idea = created.json() as { id: string };

    const brainstorm = await app.inject({
      method: 'POST',
      url: `/api/ideas/${idea.id}/brainstorm`,
    });
    const withProposals = brainstorm.json() as {
      idea: { proposals: { id: string; title: string }[] };
    };
    const proposalId = withProposals.idea.proposals[0].id;

    const approve = await app.inject({
      method: 'PATCH',
      url: `/api/ideas/${idea.id}/proposals/${proposalId}/approve`,
    });
    expect(approve.statusCode).toBe(200);
    const approved = approve.json() as {
      episodeId: string;
      jobId: string;
      idea: { status: string; episodeId: string };
    };
    expect(approved.idea.status).toBe('approved');
    expect(approved.episodeId).toBeTruthy();
    expect(approved.jobId).toBeTruthy();

    const episode = await storage.getEpisode(approved.episodeId);
    expect(episode?.content.outline.length).toBeGreaterThan(0);
    expect(episode?.content.kanbanColumn).toBe('Investigación');
    expect(episode?.content.researchBrief).toContain('David vs Goliat');

    const dir = await storage.getEpisodeDirectory(approved.episodeId);
    expect(dir).toBeTruthy();
    await access(path.join(dir!, '01-research', 'brief.md'));
    const brief = await readFile(path.join(dir!, '01-research', 'brief.md'), 'utf8');
    expect(brief).toContain(withProposals.idea.proposals[0].title);
  });

  it('PATCH discard marks proposal as discarded', async () => {
    const created = await app.inject({
      method: 'POST',
      url: '/api/ideas',
      payload: { rawIdea: 'Proverbios 3' },
    });
    const idea = created.json() as { id: string };

    const brainstorm = await app.inject({
      method: 'POST',
      url: `/api/ideas/${idea.id}/brainstorm`,
    });
    const withProposals = brainstorm.json() as {
      idea: { proposals: { id: string; status: string }[] };
    };
    const proposalId = withProposals.idea.proposals[1].id;

    const discard = await app.inject({
      method: 'PATCH',
      url: `/api/ideas/${idea.id}/proposals/${proposalId}/discard`,
    });
    expect(discard.statusCode).toBe(200);
    const body = discard.json() as { idea: { proposals: { id: string; status: string }[] } };
    const updated = body.idea.proposals.find(p => p.id === proposalId);
    expect(updated?.status).toBe('discarded');
  });
});
