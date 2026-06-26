import process from 'node:process';
import { fileURLToPath } from 'node:url';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3000/api';
const POLL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000);
const REDIS_URL = process.env.REDIS_URL;

export function getReadyMessage(): string {
  return 'Creator AI Studio production worker ready.';
}

interface ProductionJob {
  id: string;
  episodeId: string;
  type: string;
  status: string;
}

function apiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = process.env.CAS_API_KEY;
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  return fetch(`${API_BASE}${path}`, {
    ...init,
    headers: { ...apiHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  });
}

async function fetchPendingJobs(): Promise<ProductionJob[]> {
  const response = await apiFetch('/jobs/pending');
  if (!response.ok) return [];
  return (await response.json()) as ProductionJob[];
}

async function patchJob(
  id: string,
  patch: { status: string; progress: number; result?: Record<string, unknown>; error?: string },
): Promise<void> {
  await apiFetch(`/jobs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export async function processJob(job: ProductionJob): Promise<void> {
  console.log(`Processing job ${job.id} (${job.type}) for episode ${job.episodeId}`);
  await patchJob(job.id, { status: 'active', progress: 10 });

  try {
    const episodeRes = await apiFetch(`/episodes/${job.episodeId}`);
    const episode = (await episodeRes.json()) as {
      title?: string;
      content?: { script?: string; outline?: string[] };
    };

    if (job.type === 'script') {
      const res = await apiFetch('/ai/generate-script', {
        method: 'POST',
        body: JSON.stringify({
          prompt: episode.title ?? 'Nuevo video',
          options: { theme: 'Reflexiones', style: 'Narrativo' },
        }),
      });
      const data = (await res.json()) as { text?: string };
      await apiFetch(`/episodes/${job.episodeId}`, {
        method: 'PATCH',
        body: JSON.stringify({
          content: {
            script: data.text ?? '',
            outline: episode.content?.outline ?? [],
          },
        }),
      });
    }

    if (job.type === 'tts') {
      await apiFetch('/integrations/elevenlabs/tts', {
        method: 'POST',
        body: JSON.stringify({
          text: episode.content?.script ?? '',
          episodeId: job.episodeId,
        }),
      });
    }

    if (job.type === 'thumbnail') {
      const res = await apiFetch('/ai/generate-image', {
        method: 'POST',
        body: JSON.stringify({
          prompt: `Miniatura YouTube para: ${episode.title ?? 'video'}`,
          aspectRatio: '16:9',
        }),
      });
      const data = (await res.json()) as { imageUrl?: string };
      if (data.imageUrl) {
        await apiFetch(`/episodes/${job.episodeId}`, {
          method: 'PATCH',
          body: JSON.stringify({ content: { thumbnailUrl: data.imageUrl } }),
        });
      }
    }

    if (job.type === 'render') {
      await new Promise(resolve => setTimeout(resolve, 3000));
    }

    if (job.type === 'publish') {
      await apiFetch('/integrations/youtube/upload', {
        method: 'POST',
        body: JSON.stringify({ episodeId: job.episodeId }),
      });
    }

    await patchJob(job.id, { status: 'completed', progress: 100, result: { ok: true } });
    console.log(`Job ${job.id} completed`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    await patchJob(job.id, { status: 'failed', progress: 0, error: message });
    console.error(`Job ${job.id} failed:`, err);
  }
}

export async function pollLoop(): Promise<void> {
  const jobs = await fetchPendingJobs();
  for (const job of jobs) {
    await processJob(job);
  }
}

async function startBullMQWorker(): Promise<void> {
  const { Worker } = await import('bullmq');
  new Worker(
    'cas-production',
    async bullJob => {
      const { jobId } = bullJob.data as { jobId: string };
      const res = await apiFetch(`/jobs/${jobId}`);
      if (!res.ok) return;
      const job = (await res.json()) as ProductionJob;
      if (job.status === 'pending') await processJob(job);
    },
    { connection: { url: REDIS_URL! } },
  );
  console.log('BullMQ worker listening on cas-production');
}

export function main(): void {
  console.log(getReadyMessage());
  console.log(`API ${API_BASE}`);

  if (REDIS_URL) {
    void startBullMQWorker();
  }

  console.log(`Polling ${API_BASE}/jobs/pending every ${POLL_MS}ms`);
  void pollLoop();
  setInterval(() => {
    void pollLoop();
  }, POLL_MS);
}

const isDirectRun = process.argv[1] === fileURLToPath(import.meta.url);
if (isDirectRun) {
  main();
}
