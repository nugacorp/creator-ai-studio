import process from 'node:process';
import { fileURLToPath } from 'node:url';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3000/api';
const POLL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000);

export function getReadyMessage(): string {
  return 'Creator AI Studio production worker ready.';
}

interface ProductionJob {
  id: string;
  episodeId: string;
  type: string;
  status: string;
}

async function fetchPendingJobs(): Promise<ProductionJob[]> {
  const response = await fetch(`${API_BASE}/jobs/pending`);
  if (!response.ok) return [];
  return (await response.json()) as ProductionJob[];
}

async function patchJob(
  id: string,
  patch: { status: string; progress: number; result?: Record<string, unknown>; error?: string },
): Promise<void> {
  await fetch(`${API_BASE}/jobs/${id}`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(patch),
  });
}

async function processJob(job: ProductionJob): Promise<void> {
  console.log(`Processing job ${job.id} (${job.type}) for episode ${job.episodeId}`);
  await patchJob(job.id, { status: 'active', progress: 10 });

  try {
    if (job.type === 'tts') {
      const episode = (await fetch(`${API_BASE}/episodes/${job.episodeId}`).then(r =>
        r.json(),
      )) as { content?: { script?: string } };
      await fetch(`${API_BASE}/ai/tts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text: episode.content?.script ?? '', voice: 'narrativa' }),
      });
    }

    if (job.type === 'render' || job.type === 'thumbnail' || job.type === 'script') {
      await new Promise(resolve => setTimeout(resolve, 2000));
    }

    if (job.type === 'publish') {
      await fetch(`${API_BASE}/integrations/youtube/upload`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
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

export function main(): void {
  console.log(getReadyMessage());
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
