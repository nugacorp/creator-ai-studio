#!/usr/bin/env node
/**
 * CAS-HERMES-VAL — staging smoke for Agent System v1.
 *
 * Usage:
 *   CAS_STAGING_URL=https://creator-ai-studio.217.76.56.66.sslip.io \
 *   CAS_STAGING_TOKEN=<supabase_jwt_or_cas_api_key> \
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

async function main() {
  console.log(`CAS-HERMES-VAL @ ${api}\n`);

  const health = await fetch(`${api}/health`);
  ok('API health', health.ok, String(health.status));

  const agentsRes = await apiFetch('/agents');
  const agentCount = agentsRes.body?.agents?.length ?? 0;
  if (!ok('GET /agents', agentsRes.status === 200 && agentsRes.body?.orchestrator === 'hermes', `${agentCount} agents`)) {
    failed++;
  }
  if (!ok('11 agents registered', agentCount >= 11, `count=${agentCount}`)) failed++;

  const title = `CAS-HERMES-VAL ${new Date().toISOString().slice(0, 10)}`;
  const createRes = await apiFetch('/episodes', { method: 'POST', body: JSON.stringify({ title }) });
  const episodeId = createRes.body?.id;
  if (!ok('Create test episode', createRes.status === 201 && Boolean(episodeId), episodeId ?? '')) {
    failed++;
    process.exit(1);
  }

  const hermesRes = await apiFetch(`/episodes/${episodeId}/agents/hermes/run`, {
    method: 'POST',
    body: JSON.stringify({ async: false, autoEnqueuePlan: false }),
  });
  if (!ok('Hermes sync', hermesRes.status === 200 && hermesRes.body?.run?.status === 'completed')) failed++;

  const jobsRes = await apiFetch(`/episodes/${episodeId}/jobs`);
  const jobs = Array.isArray(jobsRes.body) ? jobsRes.body : [];
  const pipelineJobs = jobs.filter(j => ['tts', 'render', 'publish', 'pipeline'].includes(j.type));
  if (!ok('No tts/render/publish after Hermes (no autoEnqueue)', pipelineJobs.length === 0)) failed++;

  const researcherRes = await apiFetch(`/episodes/${episodeId}/agents/researcher/run`, {
    method: 'POST',
    body: JSON.stringify({ async: false }),
  });
  if (!ok('Researcher sync', researcherRes.status === 200 && researcherRes.body?.run?.status === 'completed')) {
    failed++;
  }

  const scriptRes = await apiFetch(`/episodes/${episodeId}/agents/scriptwriter/run`, {
    method: 'POST',
    body: JSON.stringify({ async: false }),
  });
  if (!ok('Scriptwriter sync', scriptRes.status === 200 && scriptRes.body?.run?.status === 'completed')) {
    failed++;
  }

  const detailRes = await apiFetch(`/episodes/${episodeId}`);
  const scriptLen = detailRes.body?.content?.script?.length ?? 0;
  if (!ok('Script in episode content', scriptLen > 50, `${scriptLen} chars`)) failed++;

  const assetsRes = await apiFetch(`/episodes/${episodeId}/assets`);
  const files = assetsRes.body?.files ?? [];
  const hasScriptAsset = files.some(f => f.key === 'script' && f.available);
  if (!ok('Script asset listed', hasScriptAsset)) failed++;

  const runsRes = await apiFetch(`/episodes/${episodeId}/agent-runs`);
  const runs = runsRes.body?.runs ?? [];
  if (!ok('agent-runs persisted', runs.length >= 3, `${runs.length} runs`)) failed++;

  const modeRes = await fetch(`${api}/system/mode`);
  const mode = await modeRes.json();
  ok('AI provider configured', mode.aiProvider && mode.aiProvider !== 'demo', mode.aiProvider);

  console.log(`\n${failed === 0 ? 'PASS' : `FAIL (${failed} checks)`}`);
  process.exit(failed === 0 ? 0 : 1);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
