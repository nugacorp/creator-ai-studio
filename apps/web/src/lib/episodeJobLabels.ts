import type { JobType } from '@creator-ai-studio/shared';

export const PIPELINE_STEP_LABELS: Record<string, string> = {
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

export const JOB_TYPE_LABELS: Partial<Record<JobType, string>> = {
  script: 'Generando guion',
  seo: 'Optimizando SEO',
  tts: 'Generando narración',
  thumbnail: 'Generando miniatura',
  render: 'Renderizando video',
  shorts: 'Generando Shorts',
  pipeline: 'Pipeline de producción',
  agent: 'Agente IA',
  publish: 'Publicando en YouTube',
  publish_package: 'Preparando publicación',
  archive: 'Archivando episodio',
};

export const AGENT_LABELS: Record<string, string> = {
  scriptwriter: 'Generando guion',
  researcher: 'Investigando tema',
  narrator: 'Generando narración',
  storyboard_designer: 'Diseñando storyboard',
  scene_asset_designer: 'Generando imágenes de escena',
  video_editor: 'Renderizando video',
  seo_optimizer: 'Optimizando SEO',
  thumbnail_designer: 'Generando miniatura',
  shorts_agent: 'Generando Shorts',
  hermes: 'Orquestando pipeline',
};

/** Asset file keys affected while a job type runs */
export const JOB_ASSET_KEYS: Partial<Record<JobType, string[]>> = {
  script: ['script'],
  tts: ['audio'],
  render: ['video'],
  thumbnail: ['thumbnail'],
  shorts: ['short'],
};

export const AGENT_ASSET_KEYS: Record<string, string[]> = {
  scriptwriter: ['script'],
  narrator: ['audio'],
  video_editor: ['video'],
  thumbnail_designer: ['thumbnail'],
  shorts_agent: ['short'],
  scene_asset_designer: ['scene_images'],
  storyboard_designer: ['scene_images'],
};

export function jobStatusLabel(job: {
  type: JobType;
  progress: number;
  payload?: Record<string, unknown>;
  result?: Record<string, unknown>;
}): string {
  const stepKey =
    (job.result?.stepKey as string | undefined) ??
    (job.result?.step as string | undefined);
  if (stepKey && PIPELINE_STEP_LABELS[stepKey]) {
    const sceneIndex = job.result?.sceneIndex as number | undefined;
    const totalScenes = job.result?.totalScenes as number | undefined;
    if (stepKey === 'scene_images' && sceneIndex && totalScenes) {
      return `Generando imagen ${sceneIndex}/${totalScenes}…`;
    }
    return `${PIPELINE_STEP_LABELS[stepKey]} — ${job.progress}%`;
  }
  if (job.type === 'agent') {
    const agentId = job.payload?.agentId as string | undefined;
    const label = agentId ? AGENT_LABELS[agentId] ?? 'Agente IA' : 'Agente IA';
    return `${label} — ${job.progress}%`;
  }
  const base = JOB_TYPE_LABELS[job.type] ?? job.type;
  return `${base} — ${job.progress}%`;
}

export function inProgressAssetKeys(jobs: Array<{
  type: JobType;
  status: string;
  payload?: Record<string, unknown>;
}>): Map<string, string> {
  const map = new Map<string, string>();
  for (const job of jobs) {
    if (job.status !== 'pending' && job.status !== 'active') continue;
    if (job.type === 'agent') {
      const agentId = job.payload?.agentId as string | undefined;
      if (agentId) {
        for (const key of AGENT_ASSET_KEYS[agentId] ?? []) {
          map.set(key, AGENT_LABELS[agentId] ?? 'Generando…');
        }
      }
      continue;
    }
    if (job.type === 'pipeline') {
      map.set('video', 'Pipeline en progreso…');
      map.set('script', 'Pipeline en progreso…');
      map.set('audio', 'Pipeline en progreso…');
      continue;
    }
    for (const key of JOB_ASSET_KEYS[job.type] ?? []) {
      map.set(key, JOB_TYPE_LABELS[job.type] ?? 'Generando…');
    }
  }
  return map;
}
