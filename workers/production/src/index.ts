import process from 'node:process';
import { fileURLToPath } from 'node:url';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3000/api';
const POLL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000);
const REDIS_URL = process.env.REDIS_URL;

const PIPELINE_STEP_LABELS: Record<string, string> = {
  script: 'Guion IA',
  seo: 'Metadatos SEO',
  tts: 'Narración',
  thumbnail: 'Miniatura',
  render: 'Render de video',
  shorts: 'Short vertical',
  publish: 'Subida a YouTube',
  confirm: 'Confirmar publicación',
};

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
  if (!response.ok) {
    const text = await response.text().catch(() => '');
    console.error(`Failed to fetch pending jobs (${response.status}): ${text.slice(0, 200)}`);
    return [];
  }
  return (await response.json()) as ProductionJob[];
}

async function patchJob(
  id: string,
  patch: { status?: string; progress: number; result?: Record<string, unknown>; error?: string },
): Promise<void> {
  const res = await apiFetch(`/jobs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`Failed to patch job ${id} (${res.status}): ${text.slice(0, 200)}`);
  }
}

/**
 * Claim a pending job by moving it to `active`. The API returns 409 when the
 * job was already claimed (e.g. by an overlapping poll or another worker).
 */
async function claimJob(id: string): Promise<boolean> {
  const res = await apiFetch(`/jobs/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'active', progress: 5 }),
  });
  if (res.status === 409) {
    console.log(`Job ${id} already claimed elsewhere, skipping`);
    return false;
  }
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.error(`Failed to claim job ${id} (${res.status}): ${text.slice(0, 200)}`);
    return false;
  }
  return true;
}

async function assertOk(res: Response, step: string): Promise<void> {
  if (res.ok) return;
  let message = `${step} failed (${res.status})`;
  try {
    const body = (await res.json()) as { error?: string; message?: string };
    message = body.error ?? body.message ?? message;
  } catch {
    // ignore parse errors
  }
  throw new Error(message);
}

async function runScriptJob(job: ProductionJob): Promise<void> {
  const episodeRes = await apiFetch(`/episodes/${job.episodeId}`);
  await assertOk(episodeRes, 'load episode for script');
  const episode = (await episodeRes.json()) as {
    title?: string;
    content?: { script?: string; outline?: string[] };
  };

  const res = await apiFetch('/ai/generate-script', {
    method: 'POST',
    body: JSON.stringify({
      prompt: episode.title ?? 'Nuevo video',
      options: { theme: 'Reflexiones', style: 'Narrativo' },
    }),
  });
  await assertOk(res, 'generate script');
  const data = (await res.json()) as { text?: string };
  const patchRes = await apiFetch(`/episodes/${job.episodeId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      content: {
        script: data.text ?? '',
        outline: episode.content?.outline ?? [],
      },
    }),
  });
  await assertOk(patchRes, 'save script');
}

async function runSeoJob(job: ProductionJob): Promise<void> {
  const episodeRes = await apiFetch(`/episodes/${job.episodeId}`);
  await assertOk(episodeRes, 'load episode for SEO');
  const episode = (await episodeRes.json()) as {
    title?: string;
    content?: { script?: string };
  };

  const res = await apiFetch('/ai/seo', {
    method: 'POST',
    body: JSON.stringify({
      title: episode.title ?? '',
      script: episode.content?.script ?? '',
    }),
  });
  await assertOk(res, 'generate SEO');
  const data = (await res.json()) as { description?: string; tags?: string[]; titles?: string[] };
  const patchRes = await apiFetch(`/episodes/${job.episodeId}`, {
    method: 'PATCH',
    body: JSON.stringify({
      content: {
        seoDescription: data.description ?? '',
        seoTags: data.tags ?? [],
        seoTitles: data.titles ?? [],
      },
    }),
  });
  await assertOk(patchRes, 'save SEO');
}

async function runTtsJob(job: ProductionJob): Promise<void> {
  const episodeRes = await apiFetch(`/episodes/${job.episodeId}`);
  await assertOk(episodeRes, 'load episode for TTS');
  const episode = (await episodeRes.json()) as { content?: { script?: string } };
  const res = await apiFetch('/integrations/elevenlabs/tts', {
    method: 'POST',
    body: JSON.stringify({
      text: episode.content?.script ?? '',
      episodeId: job.episodeId,
    }),
  });
  await assertOk(res, 'TTS');
}

async function runThumbnailJob(job: ProductionJob): Promise<void> {
  const res = await apiFetch(`/episodes/${job.episodeId}/thumbnail`, { method: 'POST' });
  await assertOk(res, 'thumbnail');
}

async function runRenderJob(job: ProductionJob): Promise<void> {
  const res = await apiFetch(`/episodes/${job.episodeId}/render`, { method: 'POST' });
  await assertOk(res, 'render');
}

async function runShortsJob(job: ProductionJob): Promise<void> {
  const res = await apiFetch(`/episodes/${job.episodeId}/shorts`, { method: 'POST' });
  await assertOk(res, 'shorts');
}

async function runPublishJob(job: ProductionJob): Promise<{ youtubeUrl?: string; videoId?: string }> {
  const res = await apiFetch('/integrations/youtube/upload', {
    method: 'POST',
    body: JSON.stringify({ episodeId: job.episodeId }),
  });
  await assertOk(res, 'YouTube upload');
  const data = (await res.json()) as { url?: string; videoId?: string; status?: string };
  if (data.status === 'demo') {
    throw new Error(
      'YouTube OAuth no conectado. Ve a Configuración → Integraciones y conecta Google/YouTube.',
    );
  }
  return { youtubeUrl: data.url, videoId: data.videoId };
}

async function runArchiveJob(job: ProductionJob): Promise<void> {
  const res = await apiFetch(`/episodes/${job.episodeId}/archive`, { method: 'POST' });
  await assertOk(res, 'archive');
}

async function runPipelineJob(job: ProductionJob): Promise<Record<string, unknown>> {
  const steps: Array<{ key: string; fn: () => Promise<{ youtubeUrl?: string; videoId?: string } | void> }> = [
    { key: 'script', fn: () => runScriptJob(job) },
    { key: 'seo', fn: () => runSeoJob(job) },
    { key: 'tts', fn: () => runTtsJob(job) },
    { key: 'thumbnail', fn: () => runThumbnailJob(job) },
    { key: 'render', fn: () => runRenderJob(job) },
    { key: 'shorts', fn: () => runShortsJob(job) },
    { key: 'publish', fn: () => runPublishJob(job) },
    {
      key: 'confirm',
      fn: async () => {
        const res = await apiFetch(`/episodes/${job.episodeId}/confirm-publish`, { method: 'POST' });
        await assertOk(res, 'confirm publish');
      },
    },
  ];

  let youtubeUrl: string | undefined;
  let videoId: string | undefined;

  for (let i = 0; i < steps.length; i++) {
    const step = steps[i];
    const progress = Math.round(((i + 1) / steps.length) * 90);
    await patchJob(job.id, {
      progress,
      result: {
        step: PIPELINE_STEP_LABELS[step.key] ?? step.key,
        stepKey: step.key,
        stepIndex: i + 1,
        totalSteps: steps.length,
      },
    });
    const result = await step.fn();
    if (result && 'youtubeUrl' in result) {
      youtubeUrl = result.youtubeUrl;
      videoId = result.videoId;
    }
  }

  return { ok: true, youtubeUrl, videoId };
}

export async function processJob(job: ProductionJob): Promise<void> {
  console.log(`Processing job ${job.id} (${job.type}) for episode ${job.episodeId}`);
  if (!(await claimJob(job.id))) {
    return;
  }

  try {
    let result: Record<string, unknown> = { ok: true };

    switch (job.type) {
      case 'script':
        await runScriptJob(job);
        break;
      case 'tts':
        await runTtsJob(job);
        break;
      case 'thumbnail':
        await runThumbnailJob(job);
        break;
      case 'render':
        await runRenderJob(job);
        break;
      case 'shorts':
        await runShortsJob(job);
        break;
      case 'publish':
        result = { ...(await runPublishJob(job)), ok: true };
        break;
      case 'archive':
        await runArchiveJob(job);
        break;
      case 'pipeline':
        result = await runPipelineJob(job);
        break;
      default:
        throw new Error(`unknown job type: ${job.type}`);
    }

    await patchJob(job.id, { status: 'completed', progress: 100, result });
    console.log(`Job ${job.id} completed`);
  } catch (err) {
    const message = err instanceof Error ? err.message : 'unknown error';
    await patchJob(job.id, { status: 'failed', progress: 0, error: message });
    console.error(`Job ${job.id} failed:`, err);
  }
}

let polling = false;

export async function pollLoop(): Promise<void> {
  // Overlap guard: if a long render is still running when the next interval
  // fires, skip instead of processing the same queue concurrently.
  if (polling) return;
  polling = true;
  try {
    const jobs = await fetchPendingJobs();
    for (const job of jobs) {
      await processJob(job);
    }
  } finally {
    polling = false;
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
  if (!process.env.CAS_API_KEY) {
    console.warn('CAS_API_KEY not set — worker may receive 401 from API when Supabase auth is enabled');
  }

  if (REDIS_URL) {
    // BullMQ is the single consumer when Redis is available; the claim
    // endpoint (409) protects against double processing either way.
    void startBullMQWorker();
    // One reconciliation pass for jobs enqueued while Redis was down.
    void pollLoop();
    return;
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
