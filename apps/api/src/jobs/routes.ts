import type { FastifyInstance } from 'fastify';
import { isJobType } from '@creator-ai-studio/shared';
import { createJob, getJob, listJobsForEpisode, getPendingJobs, updateJob } from './store.js';
import { enqueueJob } from './queue.js';
import { createJobBody, patchJobBody } from '../http/schemas.js';

function route(prefix: string, path: string): string {
  return `${prefix}${path}`;
}

export function registerJobRoutes(app: FastifyInstance, prefix: '' | '/api'): void {
  app.post(route(prefix, '/episodes/:id/jobs'), { schema: { body: createJobBody } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { type?: string; payload?: Record<string, unknown> };

    if (!isJobType(body.type)) {
      reply.code(400);
      return { error: 'invalid job type' };
    }

    const job = await createJob(id, { type: body.type, payload: body.payload });
    await enqueueJob(job);
    reply.code(201);
    return job;
  });

  app.get(route(prefix, '/jobs/:id'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const job = await getJob(id);
    if (!job) {
      reply.code(404);
      return { error: 'job not found' };
    }
    return job;
  });

  app.get(route(prefix, '/episodes/:id/jobs'), async (request) => {
    const { id } = request.params as { id: string };
    return await listJobsForEpisode(id);
  });

  app.get(route(prefix, '/jobs/pending'), async () => getPendingJobs());

  app.patch(route(prefix, '/jobs/:id'), { schema: { body: patchJobBody } }, async (request, reply) => {
    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as {
      status?: string;
      progress?: number;
      result?: Record<string, unknown>;
      error?: string;
    };

    const existing = await getJob(id);
    if (!existing) {
      reply.code(404);
      return { error: 'job not found' };
    }

    // Atomic claim: a job can only move to `active` from `pending`. This keeps
    // two workers (or the poll loop + BullMQ) from processing the same job.
    // Progress updates must be sent WITHOUT `status` once the job is claimed.
    if (body.status === 'active' && existing.status !== 'pending') {
      reply.code(409);
      return { error: 'job_not_claimable', status: existing.status };
    }

    const job = await updateJob(id, {
      status: body.status as import('@creator-ai-studio/shared').JobStatus | undefined,
      progress: body.progress,
      result: body.result,
      error: body.error,
    });
    if (!job) {
      reply.code(404);
      return { error: 'job not found' };
    }
    return job;
  });
}
