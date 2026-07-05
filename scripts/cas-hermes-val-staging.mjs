#!/usr/bin/env node
/**
 * CAS-HERMES-VAL — staging smoke for Agent System v1.1.
 *
 * Usage (PowerShell):
 *   $env:CAS_STAGING_URL="https://creator-ai-studio.217.76.56.66.sslip.io"
 *   $env:CAS_STAGING_TOKEN="<supabase_jwt_or_cas_api_key>"
 *   node scripts/cas-hermes-val-staging.mjs
 */

const base = (process.env.CAS_STAGING_URL ?? 'https://creator-ai-studio.217.76.56.66.sslip.io').replace(
  /\/$/,
  '',
);
const token = process.env.CAS_STAGING_TOKEN ?? process.env.CAS_API_KEY;

if (!token) {
  console.error('Set CAS_STAGING_TOKEN or CAS_API_KEY');
  process.exit(1);
}

const api = `${base}/api`;
const MIN_AGENTS = 13;

async function apiFetch(path, init = {}) {
  const res = await fetch(`${api}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(init.headers ?? {}),
    },
  });
  const text = await res.text();
  let body;
  try {
    body = JSON.parse(text);
  } catch {
    body = text;
  }
  return { status: res.status, body };
}

function ok(label, pass, detail = '') {
  console.log(`${pass ? '✓' : '✗'} ${label}${detail ? ` — ${detail}` : ''}`);
  return pass;
}

let failed = 0;

async function runAgent(episodeId, agentId, extra = {}) {
  return apiFetch(`/episodes/${episodeId}/agents/${agentId}/run`, {
    method: 'POST',
    body: JSON.stringify({ async: false, input: { skipApproval: true }, ...extra }),
  });
}

async function main() {
  console.log(`CAS-HERMES-VAL v1.1 @ ${api}\n`);

  const health = await fetch(`${api}/health`);
  ok('API health', health.ok, String(health.status));

  const agentsRes = await apiFetch('/agents');
  const agentCount = agentsRes.body?.agents?.length ?? 0;
  const agentIds = (agentsRes.body?.agents ?? []).map(a => a.id);
  if (!ok('GET /agents', agentsRes.status === 200 && agentsRes.body?.orchestrator === 'hermes', `${agentCount} agents`)) {
    failed++;
  }
  if (!ok(`${MIN_AGENTS} agents registered`, agentCount >= MIN_AGENTS, `count=${agentCount}`)) failed++;
  if (!ok('storyboard_designer present', agentIds.includes('storyboard_designer'))) failed++;
  if (!ok('scene_asset_designer present', agentIds.includes('scene_asset_designer'))) failed++;

  const title = `CAS-HERMES-VAL ${new Date().toISOString().slice(0, 10)}`;
  const createRes = await apiFetch('/episodes', { method: 'POST', body: JSON.stringify({ title }) });
  const episodeId = createRes.body?.id;
  if (!ok('Create test episode', createRes.status === 201 && Boolean(episodeId), episodeId ?? '')) {
    failed++;
    process.exit(1);
  }

  const hermesRes = await runAgent(episodeId, 'hermes', { autoEnqueuePlan: false });
  if (!ok('Hermes sync', hermesRes.status === 200 && hermesRes.body?.run?.status === 'completed')) failed++;

  const jobsRes = await apiFetch(`/episodes/${episodeId}/jobs`);
  const jobs = Array.isArray(jobsRes.body) ? jobsRes.body : [];
  const pipelineJobs = jobs.filter(j => ['tts', 'render', 'publish', 'pipeline'].includes(j.type));
  if (!ok('No tts/render/publish after Hermes (no autoEnqueue)', pipelineJobs.length === 0)) failed++;

  const researcherRes = await runAgent(episodeId, 'researcher');
  if (!ok('Researcher sync', researcherRes.status === 200 && researcherRes.body?.run?.status === 'completed')) {
    failed++;
  }

  const scriptRes = await runAgent(episodeId, 'scriptwriter');
  if (!ok('Scriptwriter sync', scriptRes.status === 200 && scriptRes.body?.run?.status === 'completed')) {
    failed++;
  }

  const doctrineRes = await runAgent(episodeId, 'doctrine_reviewer');
  if (!ok('Doctrine reviewer', doctrineRes.status === 200)) failed++;

  const editorialRes = await runAgent(episodeId, 'editorial_reviewer');
  if (!ok('Editorial reviewer', editorialRes.status === 200)) failed++;

  const storyboardRes = await runAgent(episodeId, 'storyboard_designer');
  if (!ok('Storyboard designer', storyboardRes.status === 200)) failed++;

  const assetsRes = await runAgent(episodeId, 'scene_asset_designer');
  if (!ok('Scene asset designer', assetsRes.status === 200)) failed++;

  const narratorRes = await runAgent(episodeId, 'narrator');
  if (!ok('Narrator sync', narratorRes.status === 200)) failed++;

  const jobsAfterNarrator = await apiFetch(`/episodes/${episodeId}/jobs`);
  const jobs2 = Array.isArray(jobsAfterNarrator.body) ? jobsAfterNarrator.body : [];
  if (!ok('TTS job enqueued by narrator', jobs2.some(j => j.type === 'tts'))) failed++;

  const videoRes = await runAgent(episodeId, 'video_editor');
  if (!ok('Video editor sync', videoRes.status === 200)) failed++;

  const jobsAfterVideo = await apiFetch(`/episodes/${episodeId}/jobs`);
  const jobs3 = Array.isArray(jobsAfterVideo.body) ? jobsAfterVideo.body : [];
  if (!ok('Render job enqueued by video_editor', jobs3.some(j => j.type === 'render'))) failed++;

  const seoRes = await runAgent(episodeId, 'seo_optimizer');
  if (!ok('SEO optimizer sync', seoRes.status === 200)) failed++;

  const jobsAfterSeo = await apiFetch(`/episodes/${episodeId}/jobs`);
  const jobs4 = Array.isArray(jobsAfterSeo.body) ? jobsAfterSeo.body : [];
  if (!ok('publish_package enqueued by seo_optimizer', jobs4.some(j => j.type === 'publish_package'))) failed++;

  const detailRes = await apiFetch(`/episodes/${episodeId}`);
  const scriptLen = detailRes.body?.content?.script?.length ?? 0;
  const sceneCount = detailRes.body?.content?.scenes?.length ?? 0;
  if (!ok('Script in episode content', scriptLen > 50, `${scriptLen} chars`)) failed++;
  if (!ok('Scenes in episode content', sceneCount > 0, `${sceneCount} scenes`)) failed++;

  const assetsListRes = await apiFetch(`/episodes/${episodeId}/assets`);
  const files = assetsListRes.body?.files ?? [];
  const hasScriptAsset = files.some(f => f.key === 'script' && f.available);
  if (!ok('Script asset listed', hasScriptAsset)) failed++;

  const runsRes = await apiFetch(`/episodes/${episodeId}/agent-runs`);
  const runs = runsRes.body?.runs ?? [];
  if (!ok('agent-runs persisted', runs.length >= 8, `${runs.length} runs`)) failed++;

  const withGates = runs.filter(r => r.qualityGate?.checks?.length);
  if (!ok('Quality gates on runs', withGates.length >= 3, `${withGates.length} with gates`)) failed++;

  const modeRes = await fetch(`${api}/system/mode`);
  const mode = await modeRes.json();
  ok('AI provider configured', mode.aiProvider && mode.aiProvider !== 'demo', mode.aiProvider);

  console.log(`\n${failed === 0 ? 'PASS — CAS-HERMES-VAL v1.1 signed off' : `FAIL (${failed} checks)`}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
