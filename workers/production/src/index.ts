import process from 'node:process';
import { fileURLToPath } from 'node:url';

const API_BASE = process.env.API_BASE_URL ?? 'http://localhost:3000/api';
const POLL_MS = Number(process.env.WORKER_POLL_INTERVAL_MS ?? 5000);
const REDIS_URL = process.env.REDIS_URL;

const PIPELINE_STEP_LABELS: Record<string, string> = {
  script: 'Guion IA',
  storyboard: 'Storyboard / escenas',
  scene_images: 'Imágenes de escenas',
  seo: 'Metadatos SEO',
  tts: 'Narración',
  thumbnail: 'Miniatura',
  render: 'Render de video',
  shorts: 'Short vertical',
  publish_package: 'Paquete de publicación',
  review: 'Listo para revisión',
  publish: 'Subida a YouTube',
  confirm: 'Confirmar publicación',
};

export type PipelineMode = 'production-draft' | 'ready-for-review' | 'publish-authorized';

export function getReadyMessage(): string {
  return 'Creator AI Studio production worker ready.';
}

interface ProductionJob {
  id: string;
  episodeId: string;
  type: string;
  status: string;
  payload?: Record<string, unknown>;
}

function apiHeaders(): Record<string, string> {
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const key = process.env.CAS_API_KEY;
  if (key) headers.Authorization = `Bearer ${key}`;
  return headers;
}

async function apiFetch(path: string, init?: RequestInit): Promise<Response> {
  const method = init?.method ?? 'GET';
  let body = init?.body;
  // Fastify rejects POST/PATCH with Content-Type: application/json and an empty body.
  if ((method === 'POST' || method === 'PATCH' || method === 'PUT') && body === undefined) {
    body = '{}';
  }
  return fetch(`${API_BASE}${path}`, {
    ...init,
    method,
    body,
    headers: { ...apiHeaders(), ...(init?.headers as Record<string, string> | undefined) },
  });
}

async function fetchPendingJobs(): Promise<ProductionJob[]> {
  try {
    const response = await apiFetch('/jobs/pending');
    if (!response.ok) {
      const text = await response.text().catch(() => '');
      console.error(`Failed to fetch pending jobs (${response.status}): ${text.slice(0, 200)}`);
      return [];
    }
    return (await response.json()) as ProductionJob[];
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to fetch pending jobs (network): ${message}`);
    return [];
  }
}

async function patchJob(
  id: string,
  patch: { status?: string; progress: number; result?: Record<string, unknown>; error?: string },
): Promise<void> {
  try {
    const res = await apiFetch(`/jobs/${id}`, {
      method: 'PATCH',
      body: JSON.stringify(patch),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error(`Failed to patch job ${id} (${res.status}): ${text.slice(0, 200)}`);
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error(`Failed to patch job ${id} (network): ${message}`);
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
    message = body.message ?? body.error ?? message;
  } catch {
    // ignore parse errors
  }
  throw new Error(message);
}

interface EpisodeSnapshot {
  title?: string;
  stages?: Array<{ stage: string; status: string }>;
  content?: {
    script?: string;
    scenes?: unknown[];
    audioUrl?: string;
    videoUrl?: string;
    thumbnailUrl?: string;
    seoDescription?: string;
  };
}

async function loadEpisode(episodeId: string): Promise<EpisodeSnapshot> {
  const res = await apiFetch(`/episodes/${episodeId}`);
  await assertOk(res, 'load episode');
  return (await res.json()) as EpisodeSnapshot;
}

function isStageCompleted(episode: EpisodeSnapshot, stage: string): boolean {
  return episode.stages?.find(s => s.stage === stage)?.status === 'completed';
}

async function completeStage(episodeId: string, stage: string): Promise<void> {
  const res = await apiFetch(`/episodes/${episodeId}/stages/${stage}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'completed' }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    console.warn(`Could not mark stage ${stage} completed (${res.status}): ${text.slice(0, 120)}`);
  }
}

async function runScriptJob(job: ProductionJob): Promise<void> {
  const episode = await loadEpisode(job.episodeId);
  if (isStageCompleted(episode, 'script') && (episode.content?.script?.trim().length ?? 0) > 50) {
    console.log(`[pipeline] ${job.episodeId}: skip script (aprobado)`);
    return;
  }

  const episodeRes = await apiFetch(`/episodes/${job.episodeId}`);
  await assertOk(episodeRes, 'load episode for script');
  const episodeFull = (await episodeRes.json()) as {
    title?: string;
    content?: { script?: string; outline?: string[] };
  };

  const res = await apiFetch('/ai/generate-script', {
    method: 'POST',
    body: JSON.stringify({
      prompt: episodeFull.title ?? 'Nuevo video',
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
        outline: episodeFull.content?.outline ?? [],
      },
    }),
  });
  await assertOk(patchRes, 'save script');
  await completeStage(job.episodeId, 'script');
}

async function runStoryboardJob(job: ProductionJob): Promise<void> {
  const res = await apiFetch(`/episodes/${job.episodeId}/storyboard/from-script`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  await assertOk(res, 'storyboard from script');
  const data = (await res.json()) as { skipped?: boolean };
  if (!data.skipped) {
    await completeStage(job.episodeId, 'storyboard');
  }
}

async function runSceneImagesJob(job: ProductionJob): Promise<void> {
  const res = await apiFetch(`/episodes/${job.episodeId}/scenes/generate-images`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  await assertOk(res, 'scene images');
  const data = (await res.json()) as { skipped?: boolean; generated?: number };
  if (!data.skipped && (data.generated ?? 0) >= 0) {
    await completeStage(job.episodeId, 'assets');
  }
}

async function runSeoJob(job: ProductionJob): Promise<void> {
  const snapshot = await loadEpisode(job.episodeId);
  if (isStageCompleted(snapshot, 'seo') && (snapshot.content?.seoDescription?.trim().length ?? 0) > 20) {
    console.log(`[pipeline] ${job.episodeId}: skip SEO (aprobado)`);
    return;
  }

  const episodeRes = await apiFetch(`/episodes/${job.episodeId}`);
  await assertOk(episodeRes, 'load episode for SEO');
  const episodeFull = (await episodeRes.json()) as {
    title?: string;
    content?: { script?: string };
  };

  const res = await apiFetch('/ai/seo', {
    method: 'POST',
    body: JSON.stringify({
      title: episodeFull.title ?? '',
      script: episodeFull.content?.script ?? '',
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
  await completeStage(job.episodeId, 'seo');
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
  const data = (await res.json()) as { skipped?: boolean };
  if (!data.skipped) {
    await completeStage(job.episodeId, 'audio');
  }
}

async function runThumbnailJob(job: ProductionJob): Promise<void> {
  const res = await apiFetch(`/episodes/${job.episodeId}/thumbnail`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  await assertOk(res, 'thumbnail');
  const data = (await res.json()) as { skipped?: boolean };
  if (!data.skipped) {
    await completeStage(job.episodeId, 'thumbnail');
  }
}

async function runRenderJob(job: ProductionJob): Promise<void> {
  const res = await apiFetch(`/episodes/${job.episodeId}/render`, {
    method: 'POST',
    body: JSON.stringify({}),
  });
  await assertOk(res, 'render');
  const data = (await res.json()) as { skipped?: boolean };
  if (!data.skipped) {
    await completeStage(job.episodeId, 'video');
  }
}

async function runShortsJob(job: ProductionJob): Promise<void> {
  const res = await apiFetch(`/episodes/${job.episodeId}/shorts`, { method: 'POST' });
  await assertOk(res, 'shorts');
}

async function runPublishJob(job: ProductionJob): Promise<{ youtubeUrl?: string; videoId?: string }> {
  // Human authorization must travel on the job payload; the API rejects
  // uploads without it (403 publish_not_authorized).
  if (job.payload?.authorized !== true) {
    throw new Error(
      'Publicación no autorizada: el job no tiene payload.authorized=true. ' +
        'Usa el flujo de publicación autorizada.',
    );
  }
  const publishAt =
    typeof job.payload?.scheduledAt === 'string' ? job.payload.scheduledAt : undefined;
  const res = await apiFetch('/integrations/youtube/upload', {
    method: 'POST',
    body: JSON.stringify({
      episodeId: job.episodeId,
      authorize: true,
      ...(publishAt ? { publishAt } : {}),
    }),
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

async function runPublishPackageJob(job: ProductionJob): Promise<void> {
  const res = await apiFetch(`/episodes/${job.episodeId}/publish-package`, { method: 'POST' });
  await assertOk(res, 'publish package');
}

async function markEpisodeReadyForReview(job: ProductionJob): Promise<void> {
  const res = await apiFetch(`/episodes/${job.episodeId}`, {
    method: 'PATCH',
    body: JSON.stringify({ status: 'review' }),
  });
  await assertOk(res, 'mark ready for review');
}

/** Resolve the pipeline mode from the job payload (safe default: draft). */
export function resolvePipelineMode(job: ProductionJob): PipelineMode {
  const mode = job.payload?.mode;
  if (mode === 'ready-for-review' || mode === 'publish-authorized') return mode;
  return 'production-draft';
}

/** Step keys per pipeline mode. Exported for tests. */
export function buildPipelineStepKeys(mode: PipelineMode): string[] {
  const draft = ['script', 'storyboard', 'scene_images', 'seo', 'tts', 'thumbnail', 'render', 'shorts', 'publish_package'];
  if (mode === 'production-draft') return draft;
  if (mode === 'ready-for-review') return [...draft, 'review'];
  return [...draft, 'publish', 'confirm'];
}

async function runPipelineJob(job: ProductionJob): Promise<Record<string, unknown>> {
  const mode = resolvePipelineMode(job);

  // Publishing steps additionally require the explicit authorization flag.
  if (mode === 'publish-authorized' && job.payload?.authorized !== true) {
    throw new Error(
      'Pipeline en modo publish-authorized sin payload.authorized=true. Abortado por seguridad.',
    );
  }

  const stepFns: Record<string, () => Promise<{ youtubeUrl?: string; videoId?: string } | void>> = {
    script: () => runScriptJob(job),
    storyboard: () => runStoryboardJob(job),
    scene_images: () => runSceneImagesJob(job),
    seo: () => runSeoJob(job),
    tts: () => runTtsJob(job),
    thumbnail: () => runThumbnailJob(job),
    render: () => runRenderJob(job),
    shorts: () => runShortsJob(job),
    publish_package: () => runPublishPackageJob(job),
    review: () => markEpisodeReadyForReview(job),
    publish: () => runPublishJob(job),
    confirm: async () => {
      const res = await apiFetch(`/episodes/${job.episodeId}/confirm-publish`, { method: 'POST' });
      await assertOk(res, 'confirm publish');
    },
  };

  const steps = buildPipelineStepKeys(mode).map(key => ({ key, fn: stepFns[key] }));

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

  return { ok: true, mode, youtubeUrl, videoId };
}

async function runAgentJob(job: ProductionJob): Promise<Record<string, unknown>> {
  const agentId = job.payload?.agentId;
  if (typeof agentId !== 'string' || !agentId) {
    throw new Error('agent job requires payload.agentId');
  }
  const res = await apiFetch(`/episodes/${job.episodeId}/agents/${agentId}/run`, {
    method: 'POST',
    body: JSON.stringify({
      async: false,
      autoEnqueuePlan: job.payload?.autoEnqueuePlan === true,
      input: job.payload?.input,
    }),
  });
  await assertOk(res, `agent ${agentId}`);
  return (await res.json()) as Record<string, unknown>;
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
      case 'storyboard':
        await runStoryboardJob(job);
        break;
      case 'scene_images':
        await runSceneImagesJob(job);
        break;
      case 'seo':
        await runSeoJob(job);
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
      case 'publish_package':
        await runPublishPackageJob(job);
        break;
      case 'archive':
        await runArchiveJob(job);
        break;
      case 'pipeline':
        result = await runPipelineJob(job);
        break;
      case 'agent':
        result = await runAgentJob(job);
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

/** Wait until the API health endpoint responds (Docker/local startup race). */
export async function waitForApiReady(
  maxAttempts = Number(process.env.WORKER_API_READY_MAX_ATTEMPTS ?? 60),
  delayMs = Number(process.env.WORKER_API_READY_DELAY_MS ?? 2000),
): Promise<boolean> {
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      const res = await apiFetch('/health');
      if (res.ok) {
        if (attempt > 1) {
          console.log(`API ready after ${attempt} attempt(s)`);
        }
        return true;
      }
    } catch {
      // retry until maxAttempts
    }
    if (attempt < maxAttempts) {
      console.warn(
        `API not ready at ${API_BASE} (attempt ${attempt}/${maxAttempts}), retrying in ${delayMs}ms…`,
      );
      await new Promise(resolve => setTimeout(resolve, delayMs));
    }
  }
  console.error(`API not reachable at ${API_BASE} after ${maxAttempts} attempts`);
  return false;
}

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

export async function main(): Promise<void> {
  console.log(getReadyMessage());
  console.log(`API ${API_BASE}`);
  if (!process.env.CAS_API_KEY) {
    console.warn('CAS_API_KEY not set — worker may receive 401 from API when Supabase auth is enabled');
  }

  await waitForApiReady();

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
  void main();
}
