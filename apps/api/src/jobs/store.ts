import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CreateJobInput, ProductionJob } from '@creator-ai-studio/shared';
import { resolveStoragePath } from '../storage/index.js';
import { dispatchWebhook } from '../integrations/webhooks.js';

function jobsDir(): string {
  return path.join(resolveStoragePath(), '..', 'jobs');
}

async function ensureJobsDir(): Promise<void> {
  await mkdir(jobsDir(), { recursive: true });
}

async function writeJob(job: ProductionJob): Promise<void> {
  await ensureJobsDir();
  await writeFile(
    path.join(jobsDir(), `${job.id}.json`),
    `${JSON.stringify(job, null, 2)}\n`,
    'utf8',
  );
}

export async function createJob(episodeId: string, input: CreateJobInput): Promise<ProductionJob> {
  const now = new Date().toISOString();
  const job: ProductionJob = {
    id: randomUUID(),
    episodeId,
    type: input.type,
    status: 'pending',
    progress: 0,
    createdAt: now,
    updatedAt: now,
  };
  await writeJob(job);
  return job;
}

export async function getJob(id: string): Promise<ProductionJob | undefined> {
  const file = path.join(jobsDir(), `${id}.json`);
  if (!existsSync(file)) return undefined;
  return JSON.parse(await readFile(file, 'utf8')) as ProductionJob;
}

export async function listJobsForEpisode(episodeId: string): Promise<ProductionJob[]> {
  if (!existsSync(jobsDir())) return [];
  const files = await readdir(jobsDir());
  const jobs: ProductionJob[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const job = JSON.parse(await readFile(path.join(jobsDir(), file), 'utf8')) as ProductionJob;
    if (job.episodeId === episodeId) jobs.push(job);
  }
  return jobs;
}

export async function updateJob(
  id: string,
  patch: Partial<Pick<ProductionJob, 'status' | 'progress' | 'result' | 'error'>>,
): Promise<ProductionJob | undefined> {
  const job = await getJob(id);
  if (!job) return undefined;
  const updated: ProductionJob = {
    ...job,
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.progress !== undefined ? { progress: patch.progress } : {}),
    ...(patch.result !== undefined ? { result: patch.result } : {}),
    ...(patch.error !== undefined ? { error: patch.error } : {}),
    updatedAt: new Date().toISOString(),
  };
  await writeJob(updated);

  if (updated.status === 'completed') {
    await dispatchWebhook('job.completed', { jobId: updated.id, type: updated.type });
  } else if (updated.status === 'failed') {
    await dispatchWebhook('job.failed', { jobId: updated.id, error: updated.error });
  }

  return updated;
}

export async function getPendingJobs(): Promise<ProductionJob[]> {
  if (!existsSync(jobsDir())) return [];
  const files = await readdir(jobsDir());
  const jobs: ProductionJob[] = [];
  for (const file of files) {
    if (!file.endsWith('.json')) continue;
    const job = JSON.parse(await readFile(path.join(jobsDir(), file), 'utf8')) as ProductionJob;
    if (job.status === 'pending') jobs.push(job);
  }
  return jobs;
}
