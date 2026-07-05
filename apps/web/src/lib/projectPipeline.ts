import type { AgentId, EpisodeStage } from '@creator-ai-studio/shared';
import type { ProjectStatus } from '../types';
import type { WorkspaceTab } from './dashboardNavigation';

export interface PipelineStep {
  column: ProjectStatus;
  label: string;
  agentId: AgentId;
  agentName: string;
  episodeStage: EpisodeStage;
  workspaceTab: WorkspaceTab;
  description: string;
  /** Secondary agents shown in the same Kanban column. */
  relatedAgentIds?: AgentId[];
}

/** Kanban columns aligned with production agents (one project = one column at a time). */
export const PIPELINE_STEPS: PipelineStep[] = [
  {
    column: 'Ideas',
    label: 'Ideación',
    agentId: 'hermes',
    agentName: 'Hermes',
    episodeStage: 'planning',
    workspaceTab: 'guion',
    description: 'Planificación del episodio y orquestación del pipeline.',
  },
  {
    column: 'Investigación',
    label: 'Investigación',
    agentId: 'researcher',
    agentName: 'Investigador Bíblico',
    episodeStage: 'research',
    workspaceTab: 'guion',
    description: 'Versículos, contexto histórico y outline doctrinal.',
  },
  {
    column: 'Guion',
    label: 'Guion y escenas',
    agentId: 'scriptwriter',
    agentName: 'Guionista',
    episodeStage: 'script',
    workspaceTab: 'guion',
    description: 'Guion narrativo, storyboard y escenas visuales.',
    relatedAgentIds: ['doctrine_reviewer', 'editorial_reviewer', 'storyboard_designer', 'scene_asset_designer'],
  },
  {
    column: 'Narración IA',
    label: 'Narración',
    agentId: 'narrator',
    agentName: 'Narrador',
    episodeStage: 'audio',
    workspaceTab: 'narracion',
    description: 'Dirección de voz y audio TTS.',
    relatedAgentIds: ['audio_engineer'],
  },
  {
    column: 'Edición',
    label: 'Edición de video',
    agentId: 'video_editor',
    agentName: 'Editor de Video',
    episodeStage: 'video',
    workspaceTab: 'video',
    description: 'Render, subtítulos, timing de escenas y video final.',
    relatedAgentIds: ['scene_asset_designer'],
  },
  {
    column: 'Miniatura',
    label: 'Miniatura',
    agentId: 'thumbnail_designer',
    agentName: 'Diseñador de Miniaturas',
    episodeStage: 'thumbnail',
    workspaceTab: 'thumbnail',
    description: 'Concepto visual y CTR de la miniatura.',
  },
  {
    column: 'Programado',
    label: 'SEO y publicación',
    agentId: 'seo_optimizer',
    agentName: 'Optimizador SEO',
    episodeStage: 'seo',
    workspaceTab: 'seo',
    description: 'Metadatos, títulos y paquete de publicación.',
  },
  {
    column: 'Publicado',
    label: 'Analytics',
    agentId: 'analytics_agent',
    agentName: 'Analista',
    episodeStage: 'analytics',
    workspaceTab: 'analytics',
    description: 'Retroalimentación de rendimiento para mejorar próximos videos.',
  },
];

export function stepForColumn(column: ProjectStatus): PipelineStep {
  return PIPELINE_STEPS.find(s => s.column === column) ?? PIPELINE_STEPS[0]!;
}

export function stepIndex(column: ProjectStatus): number {
  return PIPELINE_STEPS.findIndex(s => s.column === column);
}

export function agentsForStep(step: PipelineStep): AgentId[] {
  return [step.agentId, ...(step.relatedAgentIds ?? [])];
}
