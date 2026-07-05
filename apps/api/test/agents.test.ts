import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { access, mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { AGENT_IDS, type EpisodeDetail, type EpisodeSummary } from '@creator-ai-studio/shared';
import { buildApp } from '../src/app.js';
import { EpisodeStorage } from '../src/storage/index.js';

describe('agent system', () => {
  let storageDir: string;
  let app: FastifyInstance;
  let storage: EpisodeStorage;

  beforeEach(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'cas-agents-'));
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

  it('GET /agents lists Hermes and specialists', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/agents' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { orchestrator: string; agents: { id: string }[] };
    expect(body.orchestrator).toBe('hermes');
    expect(body.agents.some(a => a.id === 'hermes')).toBe(true);
    expect(body.agents.some(a => a.id === 'researcher')).toBe(true);
    expect(body.agents.length).toBe(AGENT_IDS.length);
  });

  it('GET /agents/:id/config returns system prompt and skills', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/agents/scriptwriter/config' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { id: string; systemPrompt: string; skills: string[] };
    expect(body.id).toBe('scriptwriter');
    expect(body.systemPrompt.length).toBeGreaterThan(20);
    expect(body.skills.length).toBeGreaterThan(0);
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
      payload: { async: false, autoEnqueuePlan: false },
    });
    expect(response.statusCode).toBe(200);
    const runsRes = await app.inject({
      method: 'GET',
      url: `/api/episodes/${episode.id}/agent-runs`,
    });
    const runs = runsRes.json() as { runs: { agentId: string }[] };
    expect(runs.runs.some(r => r.agentId === 'hermes')).toBe(true);
  });

  describe('CAS-HERMES-VAL (automated)', () => {
    it('Hermes without autoEnqueuePlan does not enqueue pipeline jobs', async () => {
      const episode = await createEpisode('CAS-HERMES-VAL no enqueue');
      const hermes = await app.inject({
        method: 'POST',
        url: `/api/episodes/${episode.id}/agents/hermes/run`,
        payload: { async: false, autoEnqueuePlan: false },
      });
      expect(hermes.statusCode).toBe(200);

      const jobsRes = await app.inject({
        method: 'GET',
        url: `/api/episodes/${episode.id}/jobs`,
      });
      const jobs = jobsRes.json() as { type: string }[];
      const forbidden = jobs.filter(j => ['tts', 'render', 'publish', 'pipeline'].includes(j.type));
      expect(forbidden).toHaveLength(0);
    });

    it('researcher and scriptwriter produce artifacts and complete stages', async () => {
      const episode = await createEpisode('CAS-HERMES-VAL artifacts');

      const researcher = await app.inject({
        method: 'POST',
        url: `/api/episodes/${episode.id}/agents/researcher/run`,
        payload: { async: false },
      });
      expect(researcher.statusCode).toBe(200);
      const researcherBody = researcher.json() as { run: { status: string } };
      expect(researcherBody.run.status).toBe('completed');

      const dir = await storage.getEpisodeDirectory(episode.id);
      expect(dir).toBeTruthy();
      const notesPath = path.join(dir!, '01-research', 'notes.md');
      await access(notesPath);
      const notes = await readFile(notesPath, 'utf8');
      expect(notes.length).toBeGreaterThan(10);

      const scriptwriter = await app.inject({
        method: 'POST',
        url: `/api/episodes/${episode.id}/agents/scriptwriter/run`,
        payload: { async: false },
      });
      expect(scriptwriter.statusCode).toBe(200);

      const scriptPath = path.join(dir!, '02-script', 'script.md');
      await access(scriptPath);
      const scriptFile = await readFile(scriptPath, 'utf8');
      expect(scriptFile.length).toBeGreaterThan(50);

      const detailRes = await app.inject({
        method: 'GET',
        url: `/api/episodes/${episode.id}`,
      });
      const detail = detailRes.json() as EpisodeDetail;
      expect(detail.content.script.length).toBeGreaterThan(50);

      const researchStage = detail.stages.find(s => s.stage === 'research');
      const scriptStage = detail.stages.find(s => s.stage === 'script');
      expect(researchStage?.status).toBe('completed');
      expect(scriptStage?.status).toBe('completed');
    });

    it('agent failure returns sanitized error without secrets', async () => {
      delete process.env.AI_ALLOW_DEMO_FALLBACK;
      delete process.env.ALLOW_MOCKS;
      process.env.AI_FALLBACK_ENABLED = 'false';
      process.env.AI_PROVIDER_DEFAULT = 'openai';
      delete process.env.OPENAI_API_KEY;

      const episode = await createEpisode('CAS-HERMES-VAL ia fail');
      const res = await app.inject({
        method: 'POST',
        url: `/api/episodes/${episode.id}/agents/researcher/run`,
        payload: { async: false },
      });
      expect(res.statusCode).toBe(502);
      const raw = res.payload;
      expect(raw).not.toMatch(/sk-[a-zA-Z0-9]{10,}/);
      expect(raw).not.toMatch(/sk-ant-/);

      delete process.env.AI_FALLBACK_ENABLED;
      delete process.env.AI_PROVIDER_DEFAULT;
      process.env.AI_ALLOW_DEMO_FALLBACK = 'true';
      process.env.ALLOW_MOCKS = 'true';
    });

    it('lists 13 agents including storyboard and scene assets (v1.1)', async () => {
      const response = await app.inject({ method: 'GET', url: '/api/agents' });
      const body = response.json() as { agents: { id: string }[] };
      expect(body.agents.length).toBe(13);
      expect(body.agents.some(a => a.id === 'storyboard_designer')).toBe(true);
      expect(body.agents.some(a => a.id === 'scene_asset_designer')).toBe(true);
    });
  });

  describe('production pipeline E2E (mocked AI)', () => {
    async function runSyncAgent(episodeId: string, agentId: string) {
      return app.inject({
        method: 'POST',
        url: `/api/episodes/${episodeId}/agents/${agentId}/run`,
        payload: { async: false, input: { skipApproval: true } },
      });
    }

    async function listJobs(episodeId: string) {
      const jobsRes = await app.inject({
        method: 'GET',
        url: `/api/episodes/${episodeId}/jobs`,
      });
      return jobsRes.json() as { id: string; type: string }[];
    }

    it('doctrine → narrator enqueues tts → video_editor enqueues render → seo enqueues publish_package', async () => {
      const episode = await createEpisode('Pipeline E2E chain');

      for (const agentId of ['researcher', 'scriptwriter'] as const) {
        const res = await runSyncAgent(episode.id, agentId);
        expect(res.statusCode).toBe(200);
      }

      for (const agentId of ['doctrine_reviewer', 'editorial_reviewer', 'storyboard_designer', 'scene_asset_designer'] as const) {
        const res = await runSyncAgent(episode.id, agentId);
        expect(res.statusCode).toBe(200);
        const body = res.json() as { run: { status: string } };
        expect(['completed', 'blocked']).toContain(body.run.status);
      }

      const detailRes = await app.inject({ method: 'GET', url: `/api/episodes/${episode.id}` });
      const detail = detailRes.json() as EpisodeDetail;
      expect(detail.content.scenes.length).toBeGreaterThan(0);

      const dir = await storage.getEpisodeDirectory(episode.id);
      await access(path.join(dir!, '03-storyboard', 'storyboard.md'));
      await access(path.join(dir!, '04-assets', 'scene-assets.json'));

      const narrator = await runSyncAgent(episode.id, 'narrator');
      expect(narrator.statusCode).toBe(200);
      let jobs = await listJobs(episode.id);
      expect(jobs.some(j => j.type === 'tts')).toBe(true);

      const video = await runSyncAgent(episode.id, 'video_editor');
      expect(video.statusCode).toBe(200);
      jobs = await listJobs(episode.id);
      expect(jobs.some(j => j.type === 'render')).toBe(true);

      const seo = await runSyncAgent(episode.id, 'seo_optimizer');
      expect(seo.statusCode).toBe(200);
      jobs = await listJobs(episode.id);
      expect(jobs.some(j => j.type === 'publish_package')).toBe(true);

      const forbidden = jobs.filter(j => j.type === 'publish');
      expect(forbidden).toHaveLength(0);
    });

    it('Hermes autoEnqueuePlan enqueues agent jobs for pending pipeline steps', async () => {
      const episode = await createEpisode('Hermes auto pipeline');
      const res = await app.inject({
        method: 'POST',
        url: `/api/episodes/${episode.id}/agents/hermes/run`,
        payload: { async: false, autoEnqueuePlan: true, input: { skipApproval: true } },
      });
      expect(res.statusCode).toBe(200);
      const body = res.json() as { enqueuedJobs?: string[] };
      expect((body.enqueuedJobs?.length ?? 0)).toBeGreaterThan(0);

      const jobs = await listJobs(episode.id);
      const agentJobs = jobs.filter(j => j.type === 'agent');
      expect(agentJobs.length).toBeGreaterThan(0);
    });

    it('POST agent-runs approve completes awaiting_approval run', async () => {
      const episode = await createEpisode('Approval gate');
      await runSyncAgent(episode.id, 'researcher');
      await runSyncAgent(episode.id, 'scriptwriter');

      const doctrine = await app.inject({
        method: 'POST',
        url: `/api/episodes/${episode.id}/agents/doctrine_reviewer/run`,
        payload: { async: false, input: { forceHumanApproval: true } },
      });
      expect(doctrine.statusCode).toBe(200);
      const doctrineBody = doctrine.json() as { run: { id: string; status: string } };
      expect(doctrineBody.run.status).toBe('awaiting_approval');

      const approve = await app.inject({
        method: 'POST',
        url: `/api/episodes/${episode.id}/agent-runs/${doctrineBody.run.id}/approve`,
      });
      expect(approve.statusCode).toBe(200);
      const approved = approve.json() as { run: { status: string } };
      expect(approved.run.status).toBe('completed');
    });

    it('editorial_reviewer blocked run logs quality gate failure (not Completado)', async () => {
      const episode = await createEpisode('Editorial gate');
      await runSyncAgent(episode.id, 'researcher');
      await runSyncAgent(episode.id, 'scriptwriter');

      const editorial = await app.inject({
        method: 'POST',
        url: `/api/episodes/${episode.id}/agents/editorial_reviewer/run`,
        payload: { async: false, input: { skipApproval: true } },
      });
      expect(editorial.statusCode).toBe(200);
      const body = editorial.json() as {
        run: { status: string; logs: string[]; qualityGate?: { passed: boolean } };
      };

      if (body.run.status === 'blocked') {
        expect(body.run.qualityGate?.passed).toBe(false);
        const lastLog = body.run.logs.at(-1) ?? '';
        expect(lastLog).not.toMatch(/Completado/);
        expect(lastLog).toMatch(/Bloqueado|puerta de calidad/i);
      } else {
        expect(body.run.status).toBe('completed');
        expect(body.run.qualityGate?.passed).not.toBe(false);
      }
    });
  });
});
