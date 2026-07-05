import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AgentRunRecord } from '@creator-ai-studio/shared';
import type { EpisodeStorage } from '../storage/index.js';

function runsFile(episodeDir: string): string {
  return path.join(episodeDir, '00-control', 'agent-runs.json');
}

async function readRuns(episodeDir: string): Promise<AgentRunRecord[]> {
  const file = runsFile(episodeDir);
  if (!existsSync(file)) return [];
  return JSON.parse(await readFile(file, 'utf8')) as AgentRunRecord[];
}

async function writeRuns(episodeDir: string, runs: AgentRunRecord[]): Promise<void> {
  await mkdir(path.join(episodeDir, '00-control'), { recursive: true });
  const file = runsFile(episodeDir);
  const tmp = `${file}.${randomUUID().slice(0, 8)}.tmp`;
  await writeFile(tmp, `${JSON.stringify(runs, null, 2)}\n`, 'utf8');
  await rename(tmp, file);
}

export async function listAgentRuns(
  storage: EpisodeStorage,
  episodeId: string,
): Promise<AgentRunRecord[]> {
  const dir = await storage.getEpisodeDirectory(episodeId);
  if (!dir) return [];
  const runs = await readRuns(dir);
  return runs.sort((a, b) => b.startedAt.localeCompare(a.startedAt));
}

export async function appendAgentRun(
  storage: EpisodeStorage,
  episodeId: string,
  run: AgentRunRecord,
): Promise<AgentRunRecord> {
  const dir = await storage.getEpisodeDirectory(episodeId);
  if (!dir) {
    throw new Error('episodio no disponible en disco local');
  }
  const runs = await readRuns(dir);
  runs.push(run);
  await writeRuns(dir, runs);
  return run;
}

export async function updateAgentRun(
  storage: EpisodeStorage,
  episodeId: string,
  runId: string,
  patch: Partial<AgentRunRecord>,
): Promise<AgentRunRecord | undefined> {
  const dir = await storage.getEpisodeDirectory(episodeId);
  if (!dir) return undefined;
  const runs = await readRuns(dir);
  const idx = runs.findIndex(r => r.id === runId);
  if (idx < 0) return undefined;
  runs[idx] = { ...runs[idx], ...patch };
  await writeRuns(dir, runs);
  return runs[idx];
}

export async function approveAgentRun(
  storage: EpisodeStorage,
  episodeId: string,
  runId: string,
): Promise<AgentRunRecord | undefined> {
  const dir = await storage.getEpisodeDirectory(episodeId);
  if (!dir) return undefined;
  const runs = await readRuns(dir);
  const idx = runs.findIndex(r => r.id === runId);
  if (idx < 0) return undefined;
  const run = runs[idx];
  if (run.status !== 'awaiting_approval') return undefined;

  runs[idx] = {
    ...run,
    status: 'completed',
    handoff: run.handoff ? { ...run.handoff, requiresHumanApproval: false } : run.handoff,
    logs: [...run.logs, `[Aprobación humana] Run ${runId} aprobado ${new Date().toISOString()}`],
  };
  await writeRuns(dir, runs);

  const stage = run.agentId === 'doctrine_reviewer'
    ? 'doctrine_review'
    : run.agentId === 'editorial_reviewer'
      ? 'editorial_review'
      : undefined;
  if (stage) {
    await storage.setStageStatus(episodeId, stage, 'completed');
  }

  return runs[idx];
}

export async function getAgentRun(
  storage: EpisodeStorage,
  episodeId: string,
  runId: string,
): Promise<AgentRunRecord | undefined> {
  const runs = await listAgentRuns(storage, episodeId);
  return runs.find(r => r.id === runId);
}
