/**
 * Local end-to-end pipeline test: create episode → production-draft pipeline → verify artifacts.
 * Usage: node scripts/local-e2e-pipeline.mjs
 */
import { spawn } from 'node:child_process';
import { mkdtemp, readdir, readFile, stat, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const API_PORT = Number(process.env.E2E_API_PORT ?? 3099);
const API_BASE = `http://127.0.0.1:${API_PORT}/api`;

const errors = [];
const steps = [];

function log(step, status, detail = '') {
  const entry = { step, status, detail };
  steps.push(entry);
  const icon = status === 'ok' ? '✓' : status === 'warn' ? '!' : '✗';
  console.log(`${icon} [${step}] ${detail || status}`);
  if (status === 'fail') errors.push({ step, detail });
}

async function waitForHealth(maxMs = 30_000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    try {
      const res = await fetch(`${API_BASE}/health`);
      if (res.ok) {
        const body = await res.json();
        return body;
      }
    } catch {
      // retry
    }
    await new Promise(r => setTimeout(r, 500));
  }
  throw new Error(`API health check timed out after ${maxMs}ms`);
}

async function fileSize(p) {
  try {
    const s = await stat(p);
    return s.size;
  } catch {
    return 0;
  }
}

async function main() {
  const workDir = await mkdtemp(path.join(tmpdir(), 'cas-e2e-'));
  const episodesDir = path.join(workDir, 'episodes');
  let apiProc = null;

  const env = {
    ...process.env,
    NODE_ENV: 'development',
    API_PORT: String(API_PORT),
    API_HOST: '127.0.0.1',
    LOCAL_STORAGE_PATH: episodesDir,
    AI_ALLOW_DEMO_FALLBACK: 'true',
    AI_PROVIDER_DEFAULT: 'demo',
    AI_IMAGE_PROVIDER: 'demo',
    AI_SCRIPT_PROVIDER: 'demo',
    // Disable auth for local E2E
    CAS_API_KEY: '',
    SUPABASE_URL: '',
    SUPABASE_JWT_SECRET: '',
    SUPABASE_SERVICE_ROLE_KEY: '',
  };
  delete env.CAS_API_KEY;
  delete env.SUPABASE_URL;

  console.log('\n=== Creator AI Studio — Local E2E Pipeline ===\n');
  console.log(`Work dir: ${workDir}`);
  console.log(`API: ${API_BASE}\n`);

  try {
    // 1. Start API
    log('1-start-api', 'pending', 'Starting API server...');
    apiProc = spawn('node', ['dist/server.js'], {
      cwd: path.join(ROOT, 'apps/api'),
      env,
      stdio: ['ignore', 'pipe', 'pipe'],
    });
    let apiLog = '';
    apiProc.stdout?.on('data', d => { apiLog += d.toString(); });
    apiProc.stderr?.on('data', d => { apiLog += d.toString(); });

    const health = await waitForHealth();
    log('1-start-api', 'ok', `API up — ffmpeg=${health.ffmpegAvailable ?? '?'}`);

    if (!health.ffmpegAvailable) {
      log('1-ffmpeg', 'fail', 'ffmpeg not detected by API — render step will fail');
    } else {
      log('1-ffmpeg', 'ok', 'ffmpeg available');
    }

    // 2. Create episode
    const createRes = await fetch(`${API_BASE}/episodes`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'E2E Local — Reflexión sobre la fe',
        description: 'Video de prueba generado automáticamente',
      }),
    });
    if (!createRes.ok) {
      const text = await createRes.text();
      log('2-create-episode', 'fail', `${createRes.status}: ${text.slice(0, 300)}`);
      return;
    }
    const episode = await createRes.json();
    log('2-create-episode', 'ok', `id=${episode.id} title="${episode.title}"`);

    // 3. Trigger safe pipeline (production-draft)
    const pipelineRes = await fetch(`${API_BASE}/episodes/${episode.id}/run-safe-pipeline`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: 'production-draft' }),
    });
    if (!pipelineRes.ok) {
      const text = await pipelineRes.text();
      log('3-run-pipeline', 'fail', `${pipelineRes.status}: ${text.slice(0, 300)}`);
      return;
    }
    const job = await pipelineRes.json();
    log('3-run-pipeline', 'ok', `job=${job.id} mode=${job.payload?.mode}`);

    // 4. Process job via worker
    process.env.API_BASE_URL = API_BASE;
    const workerUrl = pathToFileURL(path.join(ROOT, 'workers/production/dist/index.js')).href;
    const { processJob } = await import(workerUrl);
    log('4-process-job', 'pending', 'Running worker processJob...');
    const t0 = Date.now();
    await processJob(job);
    const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

    const jobRes = await fetch(`${API_BASE}/jobs/${job.id}`);
    const finalJob = await jobRes.json();
    if (finalJob.status === 'completed') {
      log('4-process-job', 'ok', `completed in ${elapsed}s`);
    } else {
      log('4-process-job', 'fail', `status=${finalJob.status} error=${finalJob.error ?? 'unknown'} step=${finalJob.result?.stepKey ?? '?'}`);
    }

    // 5. Verify episode workspace artifacts
    const dirs = await readdir(episodesDir);
    const workspace = dirs.find(d => d.includes(episode.id));
    if (!workspace) {
      log('5-artifacts', 'fail', 'Episode workspace directory not found');
      return;
    }
    const wsPath = path.join(episodesDir, workspace);
    log('5-workspace', 'ok', workspace);

    const checks = [
      { key: 'script', path: null, meta: 'content.script' },
      { key: '02-script/script.md', path: '02-script/script.md', minBytes: 50 },
      { key: '05-audio/narration.mp3', path: '05-audio/narration.mp3', minBytes: 100 },
      { key: '07-thumbnail/thumbnail.png', path: '07-thumbnail/thumbnail.png', minBytes: 100 },
      { key: '06-video/episode.mp4', path: '06-video/episode.mp4', minBytes: 1000 },
      { key: '09-shorts/short.mp4', path: '09-shorts/short.mp4', minBytes: 1000 },
      { key: '10-publish/metadata.json', path: '10-publish/metadata.json' },
      { key: '10-publish/checklist.json', path: '10-publish/checklist.json' },
    ];

    const epRes = await fetch(`${API_BASE}/episodes/${episode.id}`);
    const finalEpisode = await epRes.json();

    for (const c of checks) {
      if (c.meta === 'content.script') {
        const hasScript = Boolean(finalEpisode.content?.script?.length);
        log(`5-${c.key}`, hasScript ? 'ok' : 'fail', hasScript ? `${finalEpisode.content.script.length} chars` : 'missing');
        continue;
      }
      const full = path.join(wsPath, c.path);
      const exists = existsSync(full);
      const size = exists ? await fileSize(full) : 0;
      const ok = exists && (!c.minBytes || size >= c.minBytes);
      log(
        `5-${c.key}`,
        ok ? 'ok' : exists ? 'warn' : 'fail',
        exists ? `${size} bytes` : 'file missing',
      );
      if (!ok && !exists) {
        errors.push({ step: `artifact:${c.key}`, detail: 'file missing' });
      } else if (!ok) {
        errors.push({ step: `artifact:${c.key}`, detail: `too small (${size} bytes)` });
      }
    }

    // Publish package readiness
    const pkgRes = await fetch(`${API_BASE}/episodes/${episode.id}/publish-package`, { method: 'POST' });
    if (pkgRes.ok) {
      const pkg = await pkgRes.json();
      log('6-publish-package', pkg.ready ? 'ok' : 'warn', `ready=${pkg.ready} items=${pkg.checklist?.length ?? 0}`);
      const failed = (pkg.checklist ?? []).filter(i => !i.ok);
      for (const item of failed) {
        log('6-checklist', 'warn', `${item.key}: ${item.label ?? item.key}`);
      }
    } else {
      log('6-publish-package', 'fail', await pkgRes.text().then(t => t.slice(0, 200)));
    }

    // Final episode status
    log('7-episode-status', 'ok', `status=${finalEpisode.status}`);

    if (existsSync(path.join(wsPath, '10-publish', 'checklist.json'))) {
      const checklistRaw = JSON.parse(
        await readFile(path.join(wsPath, '10-publish', 'checklist.json'), 'utf8'),
      );
      const checklistItems = Array.isArray(checklistRaw)
        ? checklistRaw
        : checklistRaw.items ?? checklistRaw.checklist ?? [];
      console.log('\n--- Checklist ---');
      for (const item of checklistItems) {
        console.log(`  ${item.ok ? '✓' : '✗'} ${item.key}`);
      }
    }
  } catch (err) {
    log('fatal', 'fail', err instanceof Error ? err.message : String(err));
    console.error(err);
  } finally {
    if (apiProc) {
      apiProc.kill('SIGTERM');
      await new Promise(r => setTimeout(r, 500));
    }
    // Keep work dir for inspection unless CLEANUP=1
    if (process.env.CLEANUP === '1') {
      await rm(workDir, { recursive: true, force: true });
    } else {
      console.log(`\nArtifacts kept at: ${workDir}`);
    }
  }

  console.log('\n=== Summary ===');
  console.log(`Steps: ${steps.length} | Errors: ${errors.length}`);
  if (errors.length > 0) {
    console.log('\n--- Error list (for fixes) ---');
    errors.forEach((e, i) => console.log(`${i + 1}. [${e.step}] ${e.detail}`));
    process.exitCode = 1;
  } else {
    console.log('\nAll steps passed.');
  }
}

main();
