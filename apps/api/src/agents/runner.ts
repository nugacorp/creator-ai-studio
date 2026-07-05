import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  AgentHandoff,
  AgentId,
  AgentQualityGate,
  AgentRunRecord,
  EpisodeStage,
  JobType,
} from '@creator-ai-studio/shared';
import { isJobType } from '@creator-ai-studio/shared';
import { withProvider } from '../ai/router.js';
import { createJob } from '../jobs/store.js';
import { enqueueJob } from '../jobs/queue.js';
import type { EpisodeStorage } from '../storage/index.js';
import { getEpisodeForUser } from '../storage/access.js';
import { AGENT_SYSTEM_PROMPTS } from './prompts.js';
import { getAgentDefinition } from './registry.js';
import { appendAgentRun, updateAgentRun } from './store.js';

export interface RunAgentOptions {
  episodeId: string;
  agentId: AgentId;
  userId?: string;
  jobId?: string;
  input?: Record<string, unknown>;
  autoEnqueuePlan?: boolean;
}

export interface RunAgentResult {
  run: AgentRunRecord;
  enqueuedJobs?: string[];
}

const STAGE_FOR_AGENT: Partial<Record<AgentId, EpisodeStage>> = {
  hermes: 'planning',
  researcher: 'research',
  scriptwriter: 'script',
  doctrine_reviewer: 'doctrine_review',
  editorial_reviewer: 'editorial_review',
  narrator: 'audio',
  audio_engineer: 'audio',
  video_editor: 'video',
  thumbnail_designer: 'thumbnail',
  seo_optimizer: 'seo',
  analytics_agent: 'analytics',
};

const HERMES_PIPELINE_ORDER: AgentId[] = [
  'researcher',
  'scriptwriter',
  'doctrine_reviewer',
  'editorial_reviewer',
  'narrator',
  'audio_engineer',
  'seo_optimizer',
  'thumbnail_designer',
  'video_editor',
  'analytics_agent',
];

function parseJsonBlock(text: string): Record<string, unknown> | null {
  const match = text.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try {
    return JSON.parse(match[0]) as Record<string, unknown>;
  } catch {
    return null;
  }
}

async function markStage(
  storage: EpisodeStorage,
  episodeId: string,
  stage: EpisodeStage,
  status: 'in_progress' | 'completed' | 'blocked',
): Promise<void> {
  await storage.setStageStatus(episodeId, stage, status);
}

export async function runAgent(
  storage: EpisodeStorage,
  options: RunAgentOptions,
): Promise<RunAgentResult> {
  const def = getAgentDefinition(options.agentId);
  if (!def) {
    throw new Error(`unknown agent: ${options.agentId}`);
  }

  const episode = await getEpisodeForUser(storage, options.episodeId, options.userId);
  if (!episode) {
    throw new Error('episode not found');
  }

  const dir = await storage.getEpisodeDirectory(options.episodeId);
  if (!dir) {
    throw new Error('episodio archivado — restáuralo para ejecutar agentes');
  }

  const runId = randomUUID();
  const startedAt = new Date().toISOString();
  const logs: string[] = [`[${def.name}] Inicio ${startedAt}`];

  const run: AgentRunRecord = {
    id: runId,
    episodeId: options.episodeId,
    agentId: options.agentId,
    status: 'running',
    startedAt,
    logs,
    input: options.input,
    jobId: options.jobId,
  };
  await appendAgentRun(storage, options.episodeId, run);

  const stage = STAGE_FOR_AGENT[options.agentId];
  if (stage) {
    await markStage(storage, options.episodeId, stage, 'in_progress');
  }

  try {
    const result = await executeAgent(storage, options, episode, dir, logs);
    const completedAt = new Date().toISOString();
    logs.push(`[${def.name}] Completado ${completedAt}`);

    const finalRun = await updateAgentRun(storage, options.episodeId, runId, {
      status: result.blocked ? 'blocked' : 'completed',
      completedAt,
      output: result.output,
      logs,
      qualityGate: result.qualityGate,
      handoff: result.handoff,
    });

    if (stage && !result.blocked) {
      await markStage(storage, options.episodeId, stage, 'completed');
    } else if (stage && result.blocked) {
      await markStage(storage, options.episodeId, stage, 'blocked');
    }

    let enqueuedJobs: string[] | undefined;
    if (options.agentId === 'hermes' && options.autoEnqueuePlan && result.output?.plan) {
      enqueuedJobs = await enqueueHermesPlan(options.episodeId, result.output.plan as HermesPlanStep[]);
    }

    if (!result.blocked) {
      const techJobId = await enqueueTechnicalFollowUp(options.episodeId, result.output);
      if (techJobId) {
        enqueuedJobs = [...(enqueuedJobs ?? []), techJobId];
        logs.push(`[${def.name}] Job técnico encolado: ${result.output.enqueueJob}`);
        await updateAgentRun(storage, options.episodeId, runId, { logs });
      }
    }

    return { run: finalRun ?? run, enqueuedJobs };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'agent failed';
    logs.push(`[${def.name}] Error: ${message}`);
    const failed = await updateAgentRun(storage, options.episodeId, runId, {
      status: 'failed',
      completedAt: new Date().toISOString(),
      logs,
      output: { error: message },
    });
    if (stage) {
      await markStage(storage, options.episodeId, stage, 'blocked');
    }
    throw Object.assign(new Error(message), { run: failed });
  }
}

interface HermesPlanStep {
  agentId: AgentId;
  reason: string;
  priority: number;
}

interface AgentExecutionResult {
  output: Record<string, unknown>;
  qualityGate?: AgentQualityGate;
  handoff?: AgentHandoff;
  blocked?: boolean;
}

async function executeAgent(
  storage: EpisodeStorage,
  options: RunAgentOptions,
  episode: Awaited<ReturnType<typeof getEpisodeForUser>>,
  dir: string,
  logs: string[],
): Promise<AgentExecutionResult> {
  if (!episode) throw new Error('episode not found');

  const system = AGENT_SYSTEM_PROMPTS[options.agentId];
  const title = episode.title;
  const script = episode.content.script ?? '';
  const outline = episode.content.outline ?? [];

  switch (options.agentId) {
    case 'hermes':
      return runHermes(episode, logs, options.autoEnqueuePlan ?? false);
    case 'researcher':
      return runResearcher(storage, options.episodeId, dir, title, system, logs);
    case 'scriptwriter':
      return runScriptwriter(storage, options.episodeId, title, outline, script, system, logs);
    case 'doctrine_reviewer':
      return runDoctrineReviewer(script, system, logs);
    case 'editorial_reviewer':
      return runEditorialReviewer(script, system, logs);
    case 'narrator':
      return runNarrator(script, system, logs);
    case 'audio_engineer':
      return runAudioEngineer(episode.content.audioUrl, script, system, logs);
    case 'video_editor':
      return runVideoEditor(episode.content.scenes, script, system, logs);
    case 'thumbnail_designer':
      return runThumbnailDesigner(storage, options.episodeId, title, script, system, logs);
    case 'seo_optimizer':
      return runSeoOptimizer(storage, options.episodeId, title, script, system, logs);
    case 'analytics_agent':
      return runAnalyticsAgent(system, logs);
    default:
      throw new Error(`agent not implemented: ${options.agentId}`);
  }
}

async function runHermes(
  episode: NonNullable<Awaited<ReturnType<typeof getEpisodeForUser>>>,
  logs: string[],
  autoEnqueue: boolean,
): Promise<AgentExecutionResult> {
  const pending: HermesPlanStep[] = [];
  const hasOutline = (episode.content.outline?.length ?? 0) > 0;
  const hasScript = episode.content.script.trim().length > 50;

  for (const agentId of HERMES_PIPELINE_ORDER) {
    let needed = false;
    let reason = '';
    if (agentId === 'researcher' && !hasOutline) {
      needed = true;
      reason = 'Falta investigación y outline';
    } else if (agentId === 'scriptwriter' && !hasScript) {
      needed = true;
      reason = 'Falta guion';
    } else if (agentId === 'doctrine_reviewer' && hasScript) {
      needed = true;
      reason = 'Validar doctrina del guion';
    } else if (agentId === 'editorial_reviewer' && hasScript) {
      needed = true;
      reason = 'Revisión editorial';
    } else if (agentId === 'narrator' && hasScript && !episode.content.audioUrl) {
      needed = true;
      reason = 'Generar dirección de voz / TTS';
    } else if (agentId === 'seo_optimizer' && hasScript) {
      needed = true;
      reason = 'Optimizar metadatos SEO';
    } else if (agentId === 'thumbnail_designer' && !episode.content.thumbnailUrl) {
      needed = true;
      reason = 'Diseñar miniatura';
    } else if (agentId === 'video_editor' && hasScript) {
      needed = true;
      reason = 'Preparar/renderizar video';
    }
    if (needed) {
      pending.push({ agentId, reason, priority: pending.length + 1 });
    }
  }

  const planText = await withProvider('chat', async provider =>
    provider.chat([
      { role: 'system', content: AGENT_SYSTEM_PROMPTS.hermes },
      {
        role: 'user',
        content: `Episodio: "${episode.title}"
Estado: ${episode.status}
Outline: ${hasOutline ? 'sí' : 'no'}
Guion: ${hasScript ? `${episode.content.script.length} chars` : 'vacío'}
Audio: ${episode.content.audioUrl ? 'sí' : 'no'}
Miniatura: ${episode.content.thumbnailUrl ? 'sí' : 'no'}

Agentes pendientes detectados: ${JSON.stringify(pending)}

Responde JSON: {"plan":[{"agentId":"","reason":"","priority":1}],"summary":"","requiresHumanApproval":false}`,
      },
    ]),
  );

  const parsed = parseJsonBlock(planText) ?? { plan: pending, summary: 'Plan heurístico Hermes' };
  logs.push(`[Hermes] Plan: ${JSON.stringify(parsed.plan ?? pending)}`);

  return {
    output: {
      plan: (parsed.plan as HermesPlanStep[] | undefined) ?? pending,
      summary: parsed.summary ?? 'Plan de producción generado por Hermes',
      requiresHumanApproval: parsed.requiresHumanApproval ?? !autoEnqueue,
      orchestrator: 'hermes',
    },
    handoff: {
      nextAgentId: ((parsed.plan as HermesPlanStep[] | undefined) ?? pending)[0]?.agentId,
      notes: String(parsed.summary ?? 'Siguiente agente en cola'),
    },
    qualityGate: {
      passed: true,
      checks: [{ key: 'plan', label: 'Plan de producción', ok: true }],
    },
  };
}

async function enqueueHermesPlan(episodeId: string, plan: HermesPlanStep[]): Promise<string[]> {
  const ids: string[] = [];
  const sorted = [...plan].sort((a, b) => a.priority - b.priority);
  for (const step of sorted) {
    const job = await createJob(episodeId, { type: 'agent', payload: { agentId: step.agentId } });
    await enqueueJob(job);
    ids.push(job.id);
  }
  return ids;
}

async function enqueueTechnicalFollowUp(
  episodeId: string,
  output: Record<string, unknown>,
): Promise<string | undefined> {
  const requested = output.enqueueJob;
  if (typeof requested !== 'string' || !isJobType(requested) || requested === 'agent' || requested === 'pipeline') {
    return undefined;
  }
  const job = await createJob(episodeId, { type: requested as JobType });
  await enqueueJob(job);
  return job.id;
}

async function runResearcher(
  storage: EpisodeStorage,
  episodeId: string,
  dir: string,
  title: string,
  system: string,
  logs: string[],
): Promise<AgentExecutionResult> {
  const text = await withProvider('script', p =>
    p.chat([
      { role: 'system', content: system },
      { role: 'user', content: `Investiga el tema bíblico: "${title}"` },
    ]),
  );
  const parsed = parseJsonBlock(text);
  const outline = (parsed?.outline as string[] | undefined) ?? [];
  const notes = (parsed?.notes as string | undefined) ?? text;

  await mkdir(path.join(dir, '01-research'), { recursive: true });
  await writeFile(path.join(dir, '01-research', 'notes.md'), `${notes}\n`, 'utf8');
  logs.push('[Investigador] Notas guardadas en 01-research/notes.md');

  await storage.updateEpisode(episodeId, {
    content: { outline },
  });

  return {
    output: { outline, notes, raw: parsed },
    handoff: { nextAgentId: 'scriptwriter', nextStage: 'script', notes: 'Investigación lista para guion' },
    qualityGate: {
      passed: outline.length > 0,
      checks: [{ key: 'outline', label: 'Outline generado', ok: outline.length > 0 }],
    },
  };
}

async function runScriptwriter(
  storage: EpisodeStorage,
  episodeId: string,
  title: string,
  outline: string[],
  existingScript: string,
  _system: string,
  logs: string[],
): Promise<AgentExecutionResult> {
  if (existingScript.trim().length > 100) {
    logs.push('[Guionista] Guion existente — sin regenerar');
    return {
      output: { scriptLength: existingScript.length, reused: true },
      handoff: { nextAgentId: 'doctrine_reviewer', nextStage: 'doctrine_review', notes: 'Guion existente' },
      qualityGate: {
        passed: true,
        checks: [{ key: 'script', label: 'Guion presente', ok: true }],
      },
    };
  }

  const prompt = outline.length
    ? `Título: ${title}\nOutline:\n${outline.map((o, i) => `${i + 1}. ${o}`).join('\n')}`
    : title;

  const text = await withProvider('script', p =>
    p.generateScript(prompt, { theme: 'Reflexiones', style: 'Narrativo bíblico', audience: 'YouTube cristiano' }),
  );

  await storage.updateEpisode(episodeId, { content: { script: text, outline } });
  const epDir = await storage.getEpisodeDirectory(episodeId);
  if (epDir) {
    await mkdir(path.join(epDir, '02-script'), { recursive: true });
    await writeFile(path.join(epDir, '02-script', 'script.md'), text, 'utf8');
  }
  logs.push('[Guionista] Guion guardado');

  return {
    output: { scriptLength: text.length, preview: text.slice(0, 200) },
    handoff: { nextAgentId: 'doctrine_reviewer', nextStage: 'doctrine_review', notes: 'Guion listo para revisión doctrinal' },
    qualityGate: {
      passed: text.trim().length > 100,
      checks: [{ key: 'script', label: 'Guion mínimo', ok: text.trim().length > 100 }],
    },
  };
}

async function runDoctrineReviewer(
  script: string,
  system: string,
  _logs: string[],
): Promise<AgentExecutionResult> {
  const text = await withProvider('chat', p =>
    p.chat([
      { role: 'system', content: system },
      { role: 'user', content: script.slice(0, 6000) },
    ]),
  );
  const parsed = parseJsonBlock(text);
  const passed = parsed?.passed !== false;
  _logs.push(`[Revisor doctrinal] passed=${passed}`);

  return {
    output: parsed ?? { raw: text },
    blocked: !passed,
    handoff: passed
      ? { nextAgentId: 'editorial_reviewer', nextStage: 'editorial_review', notes: 'Doctrina aprobada' }
      : { notes: 'Corregir errores doctrinales antes de continuar', requiresHumanApproval: true },
    qualityGate: {
      passed,
      checks: [{ key: 'doctrine', label: 'Revisión doctrinal', ok: passed }],
    },
  };
}

async function runEditorialReviewer(
  script: string,
  system: string,
  _logs: string[],
): Promise<AgentExecutionResult> {
  const text = await withProvider('chat', p =>
    p.chat([
      { role: 'system', content: system },
      { role: 'user', content: script.slice(0, 6000) },
    ]),
  );
  const parsed = parseJsonBlock(text);
  const passed = parsed?.passed !== false;

  return {
    output: parsed ?? { raw: text },
    blocked: !passed,
    handoff: { nextAgentId: 'narrator', nextStage: 'audio', notes: 'Editorial revisado' },
    qualityGate: {
      passed,
      checks: [{ key: 'editorial', label: 'Revisión editorial', ok: passed }],
    },
  };
}

async function runNarrator(script: string, system: string, logs: string[]): Promise<AgentExecutionResult> {
  const text = await withProvider('chat', p =>
    p.chat([
      { role: 'system', content: system },
      { role: 'user', content: script.slice(0, 4000) },
    ]),
  );
  const parsed = parseJsonBlock(text);
  logs.push('[Narrador] Dirección de voz generada — ejecutar job tts para audio');

  return {
    output: { voiceDirection: parsed ?? { raw: text }, enqueueJob: 'tts' },
    handoff: { nextAgentId: 'audio_engineer', notes: 'Ejecutar TTS con la dirección de voz' },
    qualityGate: { passed: true, checks: [{ key: 'voice', label: 'Dirección de voz', ok: true }] },
  };
}

async function runAudioEngineer(
  audioUrl: string | undefined,
  script: string,
  system: string,
  logs: string[],
): Promise<AgentExecutionResult> {
  const text = await withProvider('chat', p =>
    p.chat([
      { role: 'system', content: system },
      {
        role: 'user',
        content: `Script length: ${script.length}. Audio present: ${Boolean(audioUrl)}`,
      },
    ]),
  );
  const parsed = parseJsonBlock(text);
  const ready = parsed?.ready === true || Boolean(audioUrl);
  logs.push(`[Audio] ready=${ready}, hasAudio=${Boolean(audioUrl)}`);

  return {
    output: parsed ?? { raw: text },
    handoff: { nextAgentId: 'video_editor', nextStage: 'video', notes: ready ? 'Audio OK' : 'Ejecutar TTS primero' },
    qualityGate: {
      passed: script.length > 0,
      checks: [
        { key: 'script', label: 'Guion presente', ok: script.length > 0 },
        { key: 'audio', label: 'Narración generada', ok: Boolean(audioUrl) },
      ],
    },
  };
}

async function runVideoEditor(
  scenes: { imageUrl?: string }[],
  script: string,
  system: string,
  _logs: string[],
): Promise<AgentExecutionResult> {
  const text = await withProvider('chat', p =>
    p.chat([
      { role: 'system', content: system },
      {
        role: 'user',
        content: `Escenas: ${scenes.length}. Script: ${script.length} chars.`,
      },
    ]),
  );
  const parsed = parseJsonBlock(text);
  const ready = (parsed?.ready as boolean | undefined) ?? scenes.length > 0;

  return {
    output: { ...(parsed ?? { raw: text }), enqueueJob: 'render' },
    handoff: { notes: 'Ejecutar render cuando audio y escenas estén listos' },
    qualityGate: {
      passed: ready,
      checks: [{ key: 'scenes', label: 'Escenas definidas', ok: scenes.length > 0 }],
    },
  };
}

async function runThumbnailDesigner(
  storage: EpisodeStorage,
  episodeId: string,
  title: string,
  script: string,
  system: string,
  logs: string[],
): Promise<AgentExecutionResult> {
  const text = await withProvider('chat', p =>
    p.chat([
      { role: 'system', content: system },
      { role: 'user', content: `Título: ${title}\nGuion (extracto): ${script.slice(0, 800)}` },
    ]),
  );
  const parsed = parseJsonBlock(text);
  const imagePrompt =
    (parsed?.imagePrompt as string | undefined) ??
    `Miniatura YouTube cristiana para: ${title}, alto contraste, sin texto ilegible`;

  const imageUrl = await withProvider('image', p =>
    p.generateImage(imagePrompt, { aspectRatio: '16:9', style: 'cinematic biblical' }),
  );

  await storage.updateEpisode(episodeId, { content: { thumbnailUrl: imageUrl } });
  logs.push('[Diseñador] Miniatura generada');

  return {
    output: { concept: parsed, imageUrl, enqueueJob: 'thumbnail' },
    handoff: { nextStage: 'thumbnail', notes: 'Miniatura aplicada al episodio' },
    qualityGate: { passed: Boolean(imageUrl), checks: [{ key: 'thumb', label: 'Miniatura', ok: Boolean(imageUrl) }] },
  };
}

async function runSeoOptimizer(
  storage: EpisodeStorage,
  episodeId: string,
  title: string,
  script: string,
  _system: string,
  logs: string[],
): Promise<AgentExecutionResult> {
  const result = await withProvider('seo', p => p.optimizeSEO(title, script));
  await storage.updateEpisode(episodeId, {
    content: {
      seoTitles: result.titles,
      seoDescription: result.description,
      seoTags: result.tags,
    },
  });
  logs.push('[SEO] Metadatos guardados');

  return {
    output: result as unknown as Record<string, unknown>,
    handoff: { nextStage: 'seo', notes: 'SEO optimizado' },
    qualityGate: {
      passed: result.titles.length > 0 && result.tags.length > 0,
      checks: [
        { key: 'titles', label: 'Títulos SEO', ok: result.titles.length > 0 },
        { key: 'tags', label: 'Tags', ok: result.tags.length > 0 },
      ],
    },
  };
}

async function runAnalyticsAgent(system: string, logs: string[]): Promise<AgentExecutionResult> {
  const { fetchYouTubeAnalytics } = await import('../integrations/youtube.js');
  let metrics: import('../integrations/youtube.js').YouTubeAnalyticsResult = {
    views: 0,
    subscribers: 0,
    watchTimeHours: 0,
    engagement: '0%',
    chartData: [],
    channelDistribution: [],
    isDemo: true,
  };
  try {
    metrics = await fetchYouTubeAnalytics('');
  } catch {
    logs.push('[Analista] Analytics no disponible — OAuth o scopes pendientes');
  }

  const text = await withProvider('chat', p =>
    p.chat([
      { role: 'system', content: system },
      { role: 'user', content: `Métricas: ${JSON.stringify(metrics)}` },
    ]),
  );
  const parsed = parseJsonBlock(text);

  return {
    output: { metrics, analysis: parsed ?? { raw: text } },
    handoff: { nextStage: 'analytics', notes: 'Revisar recomendaciones del analista' },
    qualityGate: { passed: true, checks: [{ key: 'analysis', label: 'Análisis generado', ok: true }] },
  };
}
