import { randomUUID } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type {
  AgentHandoff,
  AgentId,
  AgentQualityGate,
  AgentRunRecord,
  AgentRunStatus,
  EpisodeShort,
  EpisodeStage,
  JobType,
  Scene,
} from '@creator-ai-studio/shared';
import { HUMAN_APPROVAL_AGENT_IDS, isJobType } from '@creator-ai-studio/shared';
import { withProvider } from '../ai/router.js';
import { areMocksAllowed } from '../config/mocks.js';
import { resolveSceneImagePrompt } from '../media/scene-image-refine.js';
import { generateEpisodeMusic, applyMusicLabelToScenes } from '../media/music.js';
import { parseScenesFromScript } from '../media/script-to-scenes.js';
import { createJob } from '../jobs/store.js';
import { enqueueJob } from '../jobs/queue.js';
import type { EpisodeStorage } from '../storage/index.js';
import { getEpisodeForUser } from '../storage/access.js';
import { resolveAgentSystemPrompt } from './overrides.js';
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
  storyboard_designer: 'storyboard',
  scene_asset_designer: 'assets',
  narrator: 'audio',
  audio_engineer: 'audio',
  video_editor: 'video',
  thumbnail_designer: 'thumbnail',
  seo_optimizer: 'seo',
  shorts_agent: 'shorts',
  analytics_agent: 'analytics',
};

const HERMES_PIPELINE_ORDER: AgentId[] = [
  'researcher',
  'scriptwriter',
  'doctrine_reviewer',
  'editorial_reviewer',
  'storyboard_designer',
  'scene_asset_designer',
  'narrator',
  'audio_engineer',
  'thumbnail_designer',
  'video_editor',
  'seo_optimizer',
  'shorts_agent',
  'analytics_agent',
];

function shouldRequireHumanApproval(agentId: AgentId, input?: Record<string, unknown>): boolean {
  const gated = (HUMAN_APPROVAL_AGENT_IDS as readonly string[]).includes(agentId);
  if (input?.skipApproval === true) return false;
  if (input?.forceHumanApproval === true) {
    return gated;
  }
  // Approval gates may only be relaxed by the central mock policy (dev/test, or
  // ALLOW_MOCKS=true) — never in production/staging. AI_ALLOW_DEMO_FALLBACK is a
  // provider-routing flag and must NOT weaken publish safety; decouple it.
  if (areMocksAllowed()) {
    return false;
  }
  return gated;
}

function resolveRunStatus(
  result: AgentExecutionResult,
  agentId: AgentId,
  input?: Record<string, unknown>,
): AgentRunStatus {
  if (result.blocked) return 'blocked';
  if (
    result.handoff?.requiresHumanApproval &&
    result.qualityGate?.passed &&
    shouldRequireHumanApproval(agentId, input)
  ) {
    return 'awaiting_approval';
  }
  return 'completed';
}

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

    const runStatus = resolveRunStatus(result, options.agentId, options.input);
    const statusLog =
      runStatus === 'completed'
        ? `Completado ${completedAt}`
        : runStatus === 'awaiting_approval'
          ? 'Pendiente de aprobación humana'
          : runStatus === 'blocked'
            ? result.qualityGate?.passed === false
              ? 'Bloqueado — puerta de calidad no aprobada'
              : 'Bloqueado'
            : `Finalizado ${completedAt}`;
    logs.push(`[${def.name}] ${statusLog}`);

    const finalRun = await updateAgentRun(storage, options.episodeId, runId, {
      status: runStatus,
      completedAt,
      output: result.output,
      logs,
      qualityGate: result.qualityGate,
      handoff: result.handoff,
    });

    if (stage && runStatus === 'completed') {
      await markStage(storage, options.episodeId, stage, 'completed');
    } else if (stage && (runStatus === 'blocked' || runStatus === 'awaiting_approval')) {
      await markStage(storage, options.episodeId, stage, 'blocked');
    }

    let enqueuedJobs: string[] | undefined;
    if (options.agentId === 'hermes' && options.autoEnqueuePlan && result.output?.plan) {
      enqueuedJobs = await enqueueHermesPlan(options.episodeId, result.output.plan as HermesPlanStep[]);
    }

    if (runStatus === 'completed') {
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

  const system = await resolveAgentSystemPrompt(options.agentId);
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
      return runDoctrineReviewer(script, system, logs, options.input);
    case 'editorial_reviewer':
      return runEditorialReviewer(script, system, logs, options.input);
    case 'storyboard_designer':
      return runStoryboardDesigner(storage, options.episodeId, dir, title, script, system, logs);
    case 'scene_asset_designer':
      return runSceneAssetDesigner(storage, options.episodeId, dir, episode.content.scenes, system, logs);
    case 'narrator':
      return runNarrator(script, system, logs);
    case 'audio_engineer':
      return runAudioEngineer(storage, options.episodeId, dir, episode, system, logs);
    case 'video_editor':
      return runVideoEditor(episode.content.scenes, script, system, logs);
    case 'thumbnail_designer':
      return runThumbnailDesigner(storage, options.episodeId, title, script, system, logs);
    case 'seo_optimizer':
      return runSeoOptimizer(storage, options.episodeId, dir, title, script, system, logs);
    case 'shorts_agent':
      return runShortsAgent(storage, options.episodeId, dir, title, script, system, logs);
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
  const hasScenes = episode.content.scenes.length > 0;
  const scenesWithImages = episode.content.scenes.filter(s => s.imageUrl?.trim()).length;

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
    } else if (agentId === 'storyboard_designer' && hasScript && !hasScenes) {
      needed = true;
      reason = 'Crear storyboard de escenas';
    } else if (agentId === 'scene_asset_designer' && hasScenes && scenesWithImages < episode.content.scenes.length) {
      needed = true;
      reason = 'Generar assets visuales por escena';
    } else if (agentId === 'narrator' && hasScript && !episode.content.audioUrl) {
      needed = true;
      reason = 'Generar dirección de voz / TTS';
    } else if (agentId === 'audio_engineer' && hasScript) {
      needed = true;
      reason = episode.content.musicUrl
        ? 'Validar narración, mezcla y música de fondo'
        : 'Generar música Lyria y validar audio';
    } else if (agentId === 'seo_optimizer' && hasScript) {
      needed = true;
      reason = 'Optimizar metadatos SEO y paquete de publicación';
    } else if (agentId === 'shorts_agent' && hasScript && episode.content.videoUrl) {
      needed = true;
      reason = 'Identificar momentos virales y metadatos de Shorts';
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
      { role: 'system', content: await resolveAgentSystemPrompt('hermes') },
      {
        role: 'user',
        content: `Episodio: "${episode.title}"
Estado: ${episode.status}
Outline: ${hasOutline ? 'sí' : 'no'}
Guion: ${hasScript ? `${episode.content.script.length} chars` : 'vacío'}
Escenas: ${hasScenes ? episode.content.scenes.length : 0}
Assets: ${scenesWithImages}/${episode.content.scenes.length}
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
  input?: Record<string, unknown>,
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

  const needsApproval = passed && shouldRequireHumanApproval('doctrine_reviewer', input);

  return {
    output: parsed ?? { raw: text },
    blocked: !passed,
    handoff: passed
      ? {
          nextAgentId: 'editorial_reviewer',
          nextStage: 'editorial_review',
          notes: needsApproval
            ? 'Doctrina aprobada — requiere aprobación humana antes de continuar'
            : 'Doctrina aprobada',
          requiresHumanApproval: needsApproval,
        }
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
  input?: Record<string, unknown>,
): Promise<AgentExecutionResult> {
  const text = await withProvider('chat', p =>
    p.chat([
      { role: 'system', content: system },
      { role: 'user', content: script.slice(0, 6000) },
    ]),
  );
  const parsed = parseJsonBlock(text);
  const passed = parsed?.passed !== false;
  _logs.push(`[Revisor editorial] passed=${passed}`);
  const needsApproval = passed && shouldRequireHumanApproval('editorial_reviewer', input);

  return {
    output: parsed ?? { raw: text },
    blocked: !passed,
    handoff: {
      nextAgentId: 'storyboard_designer',
      nextStage: 'storyboard',
      notes: needsApproval
        ? 'Editorial revisado — requiere aprobación humana antes de storyboard'
        : 'Editorial revisado',
      requiresHumanApproval: needsApproval,
    },
    qualityGate: {
      passed,
      checks: [{ key: 'editorial', label: 'Revisión editorial', ok: passed }],
    },
  };
}

async function runStoryboardDesigner(
  storage: EpisodeStorage,
  episodeId: string,
  dir: string,
  title: string,
  script: string,
  system: string,
  logs: string[],
): Promise<AgentExecutionResult> {
  const text = await withProvider('chat', p =>
    p.chat([
      { role: 'system', content: system },
      { role: 'user', content: `Título: ${title}\nGuion:\n${script.slice(0, 5000)}` },
    ]),
  );
  const parsed = parseJsonBlock(text);
  const rawScenes = (parsed?.scenes as Array<Record<string, unknown>> | undefined) ?? [];
  const scenes: Scene[] =
    rawScenes.length > 0
      ? rawScenes.map((s, i) => {
          const visualNote = String(s.visualNote ?? s.text ?? '');
          const voiceover = String(s.voiceoverPrompt ?? '');
          const imagePrompt = String(s.imagePrompt ?? '');
          return {
            id: String(s.id ?? `scene-${i + 1}`),
            text: visualNote || voiceover.slice(0, 120),
            imageUrl: '',
            voiceoverPrompt: voiceover,
            visualNote: visualNote || undefined,
            imagePrompt: imagePrompt || undefined,
            musicTrack: 'ambient-soft',
            duration: Number(s.duration ?? 8),
            transition: String(s.transition ?? 'fade'),
          };
        })
      : fallbackScenesFromScript(script, title);

  await mkdir(path.join(dir, '03-storyboard'), { recursive: true });
  const storyboardMd = scenes.map((s, i) => `## Escena ${i + 1} (${s.duration}s)\n${s.text}\n`).join('\n');
  await writeFile(path.join(dir, '03-storyboard', 'storyboard.md'), `# Storyboard — ${title}\n\n${storyboardMd}`, 'utf8');
  await writeFile(path.join(dir, '03-storyboard', 'scenes.json'), `${JSON.stringify(scenes, null, 2)}\n`, 'utf8');
  await storage.updateEpisode(episodeId, { content: { scenes } });
  logs.push(`[Storyboard] ${scenes.length} escenas guardadas`);

  return {
    output: { sceneCount: scenes.length, summary: parsed?.summary ?? 'Storyboard generado' },
    handoff: { nextAgentId: 'scene_asset_designer', nextStage: 'assets', notes: 'Storyboard listo para assets' },
    qualityGate: {
      passed: scenes.length > 0,
      checks: [{ key: 'scenes', label: 'Escenas definidas', ok: scenes.length > 0 }],
    },
  };
}

function fallbackScenesFromScript(script: string, episodeTitle?: string): Scene[] {
  return parseScenesFromScript(script, episodeTitle);
}

async function runSceneAssetDesigner(
  storage: EpisodeStorage,
  episodeId: string,
  dir: string,
  scenes: Scene[],
  system: string,
  logs: string[],
): Promise<AgentExecutionResult> {
  if (scenes.length === 0) {
    return {
      output: { error: 'no_scenes' },
      blocked: true,
      handoff: { nextAgentId: 'storyboard_designer', notes: 'Ejecutar storyboard_designer primero' },
      qualityGate: {
        passed: false,
        checks: [{ key: 'scenes', label: 'Escenas presentes', ok: false, detail: 'Sin escenas' }],
      },
    };
  }

  const text = await withProvider('chat', p =>
    p.chat([
      { role: 'system', content: system },
      {
        role: 'user',
        content: `Escenas:\n${JSON.stringify(scenes.map(s => ({ id: s.id, text: s.text.slice(0, 120) })))}`,
      },
    ]),
  );
  const parsed = parseJsonBlock(text);
  const assets = (parsed?.assets as Array<{ sceneId?: string; imagePrompt?: string }> | undefined) ?? [];

  const updatedScenes: Scene[] = [];
  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]!;
    const asset = assets.find(a => a.sceneId === scene.id);
    const imagePrompt =
      asset?.imagePrompt ??
      (await resolveSceneImagePrompt(scene, i));
    const imageUrl = await withProvider('image', p =>
      p.generateImage(imagePrompt, { aspectRatio: '16:9', style: 'cinematic biblical' }),
    );
    updatedScenes.push({ ...scene, imageUrl, imagePrompt });
    logs.push(`[Assets] Imagen generada para ${scene.id}`);
  }

  await mkdir(path.join(dir, '04-assets'), { recursive: true });
  await writeFile(
    path.join(dir, '04-assets', 'scene-assets.json'),
    `${JSON.stringify(updatedScenes.map(s => ({ id: s.id, imageUrl: s.imageUrl })), null, 2)}\n`,
    'utf8',
  );
  await storage.updateEpisode(episodeId, { content: { scenes: updatedScenes } });

  const allHaveImages = updatedScenes.every(s => Boolean(s.imageUrl));
  return {
    output: { sceneCount: updatedScenes.length, assetsGenerated: updatedScenes.length },
    handoff: { nextAgentId: 'narrator', nextStage: 'audio', notes: 'Assets listos para narración' },
    qualityGate: {
      passed: allHaveImages,
      checks: [{ key: 'assets', label: 'Imágenes por escena', ok: allHaveImages }],
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
  storage: EpisodeStorage,
  episodeId: string,
  dir: string,
  episode: NonNullable<Awaited<ReturnType<typeof getEpisodeForUser>>>,
  system: string,
  logs: string[],
): Promise<AgentExecutionResult> {
  const script = episode.content.script ?? '';
  const audioUrl = episode.content.audioUrl;
  const scenes = episode.content.scenes;

  const text = await withProvider('chat', p =>
    p.chat([
      { role: 'system', content: system },
      {
        role: 'user',
        content: `Título: ${episode.title}
Script length: ${script.length}
Narración presente: ${Boolean(audioUrl)}
Música de fondo presente: ${Boolean(episode.content.musicUrl)}
Escenas: ${scenes.length}
Sugerencia musicTrack en escenas: ${scenes.map(s => s.musicTrack).filter(Boolean).join(', ') || 'ninguna'}`,
      },
    ]),
  );
  const parsed = parseJsonBlock(text);
  const musicPrompt =
    String(parsed?.musicPrompt ?? parsed?.backgroundMusicPrompt ?? '').trim() ||
    scenes.find(s => s.musicTrack?.trim() && s.musicTrack !== 'ambient-soft')?.musicTrack ||
    `Música instrumental ambiente suave para documental cristiano: ${episode.title}`;

  let musicGenerated = Boolean(episode.content.musicUrl);
  let musicLabel = scenes.find(s => s.musicTrack?.trim())?.musicTrack ?? '';
  try {
    const musicResult = await generateEpisodeMusic(episodeId, dir, {
      prompt: musicPrompt,
      title: episode.title,
      script,
      force: false,
    });
    musicGenerated = true;
    musicLabel = musicResult.label;
    const updatedScenes = applyMusicLabelToScenes(scenes, musicLabel);
    await storage.updateEpisode(episodeId, {
      content: { musicUrl: musicResult.musicUrl, scenes: updatedScenes },
    });
    logs.push(
      musicResult.skipped
        ? `[Audio] Música existente reutilizada (${musicLabel})`
        : `[Audio] Música Lyria generada (${musicResult.meta.model})`,
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'music generation failed';
    logs.push(`[Audio] Música no generada: ${message}`);
  }

  const ready = (parsed?.ready === true || Boolean(audioUrl)) && musicGenerated;
  logs.push(`[Audio] ready=${ready}, hasAudio=${Boolean(audioUrl)}, hasMusic=${musicGenerated}`);

  return {
    output: {
      ...(parsed ?? { raw: text }),
      musicPrompt,
      musicLabel,
      musicGenerated,
    },
    handoff: {
      nextAgentId: 'video_editor',
      nextStage: 'video',
      notes: ready ? 'Audio y música listos' : 'Ejecutar TTS y/o generar música',
    },
    qualityGate: {
      passed: script.length > 0 && Boolean(audioUrl),
      checks: [
        { key: 'script', label: 'Guion presente', ok: script.length > 0 },
        { key: 'audio', label: 'Narración generada', ok: Boolean(audioUrl) },
        { key: 'music', label: 'Música de fondo (Lyria)', ok: musicGenerated },
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
  dir: string,
  title: string,
  script: string,
  system: string,
  logs: string[],
): Promise<AgentExecutionResult> {
  const text = await withProvider('chat', p =>
    p.chat([
      { role: 'system', content: system },
      {
        role: 'user',
        content: `Título: ${title}\nGuion:\n${script.slice(0, 5000)}\n\nGenera metadatos SEO completos incluyendo pinnedComment.`,
      },
    ]),
  );
  const parsed = parseJsonBlock(text);
  const fallback = await withProvider('seo', p => p.optimizeSEO(title, script));

  const titles = (parsed?.titles as string[] | undefined)?.filter(Boolean) ?? fallback.titles;
  const description = String(parsed?.description ?? fallback.description);
  const tags = (parsed?.tags as string[] | undefined)?.filter(Boolean) ?? fallback.tags;
  const chapters = (parsed?.chapters as { time: string; title: string }[] | undefined) ?? fallback.chapters;
  const pinnedComment = String(
    parsed?.pinnedComment ?? fallback.pinnedComment ?? '',
  ).trim();

  await mkdir(path.join(dir, '08-seo'), { recursive: true });
  const seoMetadata = {
    titles,
    description,
    tags,
    chapters: chapters ?? [],
    hashtags: (parsed?.hashtags as string[] | undefined) ?? fallback.hashtags ?? [],
    pinnedComment,
    generatedAt: new Date().toISOString(),
  };
  await writeFile(
    path.join(dir, '08-seo', 'metadata.json'),
    `${JSON.stringify(seoMetadata, null, 2)}\n`,
    'utf8',
  );

  await storage.updateEpisode(episodeId, {
    content: {
      seoTitles: titles,
      seoDescription: description,
      seoTags: tags,
      seoChapters: chapters,
      pinnedComment: pinnedComment || undefined,
    },
  });
  logs.push('[SEO] Metadatos guardados en 08-seo/metadata.json');

  return {
    output: { ...seoMetadata, enqueueJob: 'publish_package' },
    handoff: { nextAgentId: 'shorts_agent', nextStage: 'shorts', notes: 'SEO optimizado — generar Shorts' },
    qualityGate: {
      passed: titles.length > 0 && tags.length > 0,
      checks: [
        { key: 'titles', label: 'Títulos SEO', ok: titles.length > 0 },
        { key: 'tags', label: 'Tags', ok: tags.length > 0 },
        {
          key: 'pinnedComment',
          label: 'Comentario fijado sugerido',
          ok: pinnedComment.length > 0,
        },
      ],
    },
  };
}

function fallbackShortMoments(script: string, title: string): EpisodeShort[] {
  const chunks = script.split(/\n\n+/).filter(p => p.trim().length > 40);
  const slice = chunks.length >= 3 ? chunks.slice(0, 3) : [script.slice(0, 400), script.slice(400, 800), script.slice(800, 1200)];
  return slice
    .filter(t => t.trim().length > 20)
    .slice(0, 5)
    .map((text, i) => ({
      id: `short-${i + 1}`,
      title: `${title} — Momento ${i + 1}`.slice(0, 70),
      description: text.slice(0, 200).trim(),
      scriptText: text.slice(0, 600).trim(),
      tags: ['shorts', 'biblia', 'fe'],
      hashtags: ['#Shorts', '#Fe', '#Biblia'],
      startTime: i * 45,
    }));
}

async function runShortsAgent(
  storage: EpisodeStorage,
  episodeId: string,
  dir: string,
  title: string,
  script: string,
  system: string,
  logs: string[],
): Promise<AgentExecutionResult> {
  const text = await withProvider('chat', p =>
    p.chat([
      { role: 'system', content: system },
      {
        role: 'user',
        content: `Título episodio: ${title}\nGuion:\n${script.slice(0, 6000)}\n\nIdentifica 3-5 momentos para Shorts verticales.`,
      },
    ]),
  );
  const parsed = parseJsonBlock(text);
  const rawShorts = (parsed?.shorts as Array<Record<string, unknown>> | undefined) ?? [];
  const shorts: EpisodeShort[] =
    rawShorts.length > 0
      ? rawShorts.slice(0, 5).map((s, i) => ({
          id: String(s.id ?? `short-${i + 1}`),
          title: String(s.title ?? `${title} — Short ${i + 1}`).slice(0, 100),
          description: String(s.description ?? '').slice(0, 500),
          scriptText: String(s.scriptText ?? s.script ?? '').slice(0, 800),
          tags: Array.isArray(s.tags) ? (s.tags as string[]).map(String) : undefined,
          hashtags: Array.isArray(s.hashtags) ? (s.hashtags as string[]).map(String) : undefined,
          startTime: Number(s.startTime ?? i * 45),
        }))
      : fallbackShortMoments(script, title);

  await mkdir(path.join(dir, '09-shorts'), { recursive: true });
  await writeFile(
    path.join(dir, '09-shorts', 'metadata.json'),
    `${JSON.stringify({ shorts, summary: parsed?.summary ?? 'Shorts generados', generatedAt: new Date().toISOString() }, null, 2)}\n`,
    'utf8',
  );
  await storage.updateEpisode(episodeId, { content: { shorts } });
  logs.push(`[Shorts] ${shorts.length} momentos identificados — encolar render shorts`);

  return {
    output: { shortCount: shorts.length, shorts, summary: parsed?.summary, enqueueJob: 'shorts' },
    handoff: { nextStage: 'shorts', notes: 'Momentos listos — renderizar recortes 9:16' },
    qualityGate: {
      passed: shorts.length >= 1,
      checks: [{ key: 'shorts', label: 'Momentos Shorts', ok: shorts.length >= 1 }],
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
