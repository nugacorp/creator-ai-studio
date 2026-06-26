import process from 'node:process';
import type { ProductionJob } from '@creator-ai-studio/shared';
import { getJob } from './store.js';

let queue: import('bullmq').Queue | null = null;

async function getQueue(): Promise<import('bullmq').Queue | null> {
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) return null;

  if (!queue) {
    const { Queue } = await import('bullmq');
    queue = new Queue('cas-production', { connection: { url: redisUrl } });
  }
  return queue;
}

export async function enqueueJob(job: ProductionJob): Promise<void> {
  const q = await getQueue();
  if (!q) return;
  await q.add('process', { jobId: job.id }, { jobId: job.id });
}

export async function enqueueJobById(jobId: string): Promise<void> {
  const job = await getJob(jobId);
  if (job) await enqueueJob(job);
}
