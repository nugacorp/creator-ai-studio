import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import type { EpisodeSummary } from '@creator-ai-studio/shared';
import { buildApp } from '../src/app.js';
import { EpisodeStorage } from '../src/storage/index.js';

describe('agent system', () => {
  let storageDir: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'cas-agents-'));
    process.env.AI_ALLOW_DEMO_FALLBACK = 'true';
    process.env.ALLOW_MOCKS = 'true';
    app = buildApp({ storage: new EpisodeStorage(storageDir) });
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

  it('GET /agents lists Hermes and specialists', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/agents' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { orchestrator: string; agents: { id: string }[] };
    expect(body.orchestrator).toBe('hermes');
    expect(body.agents.some(a => a.id === 'hermes')).toBe(true);
    expect(body.agents.some(a => a.id === 'researcher')).toBe(true);
    expect(body.agents.length).toBeGreaterThanOrEqual(10);
  });

  it('POST /episodes/:id/agents/hermes/run enqueues agent job', async () => {
    const episode = await createEpisode('Agent WO smoke');
    const response = await app.inject({
      method: 'POST',
      url: `/api/episodes/${episode.id}/agents/hermes/run`,
      payload: { async: true, autoEnqueuePlan: false },
    });
    expect(response.statusCode).toBe(202);
    const body = response.json() as { job: { type: string; payload: { agentId: string } } };
    expect(body.job.type).toBe('agent');
    expect(body.job.payload.agentId).toBe('hermes');
  });

  it('POST agent run sync persists agent-runs on episode', async () => {
    const episode = await createEpisode('Sync agent run');
    const response = await app.inject({
      method: 'POST',
      url: `/api/episodes/${episode.id}/agents/hermes/run`,
      payload: { async: false },
    });
    expect(response.statusCode).toBe(200);
    const runsRes = await app.inject({
      method: 'GET',
      url: `/api/episodes/${episode.id}/agent-runs`,
    });
    const runs = runsRes.json() as { runs: { agentId: string }[] };
    expect(runs.runs.some(r => r.agentId === 'hermes')).toBe(true);
  });
});
