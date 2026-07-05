import type { EpisodeStage, EpisodeStageStatus } from '@creator-ai-studio/shared';
import type { ProjectStatus, VideoProject } from '../types';
import type { WorkspaceTab } from './dashboardNavigation';
import { PIPELINE_STEPS, stepIndex } from './projectPipeline';

export const STAGES_BY_TAB: Record<WorkspaceTab, EpisodeStage | EpisodeStage[]> = {
  guion: 'script',
  narracion: 'audio',
  escenas: ['storyboard', 'assets'],
  subtitulos: 'subtitles',
  video: 'video',
  thumbnail: 'thumbnail',
  seo: 'seo',
  publicacion: 'publishing',
  analytics: 'analytics',
};

/** Kanban column to advance after approving a tab (when current column is at or before that step). */
export const COLUMN_AFTER_TAB_APPROVE: Partial<Record<WorkspaceTab, ProjectStatus>> = {
  guion: 'Narración IA',
  narracion: 'Edición',
  escenas: 'Edición',
  subtitulos: 'Edición',
  video: 'Miniatura',
  thumbnail: 'Programado',
  seo: 'Programado',
  publicacion: 'Publicado',
};

export const STAGE_STATUS_LABEL: Record<EpisodeStageStatus, string> = {
  pending: 'Pendiente',
  in_progress: 'En progreso',
  completed: 'Aprobado',
  blocked: 'Bloqueado',
};

export const STAGE_STATUS_PILL: Record<EpisodeStageStatus, string> = {
  pending: 'border-slate-500/30 bg-slate-500/10 text-slate-300',
  in_progress: 'border-indigo-500/30 bg-indigo-500/10 text-indigo-300',
  completed: 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300',
  blocked: 'border-rose-500/30 bg-rose-500/10 text-rose-300',
};

export function stagesForTab(tab: WorkspaceTab): EpisodeStage[] {
  const mapped = STAGES_BY_TAB[tab];
  return Array.isArray(mapped) ? mapped : [mapped];
}

export function aggregateStageStatus(
  stages: EpisodeStage[],
  statusByStage: Map<EpisodeStage, EpisodeStageStatus>,
): EpisodeStageStatus {
  if (stages.length === 0) return 'pending';
  const statuses = stages.map(s => statusByStage.get(s) ?? 'pending');
  if (statuses.every(s => s === 'completed')) return 'completed';
  if (statuses.some(s => s === 'blocked')) return 'blocked';
  if (statuses.some(s => s === 'in_progress')) return 'in_progress';
  if (statuses.some(s => s === 'completed')) return 'in_progress';
  return 'pending';
}

export interface TabApprovalValidation {
  ok: boolean;
  message?: string;
}

export function validateTabForApproval(
  tab: WorkspaceTab,
  project: VideoProject,
  extras?: { subtitlesSrt?: string; audioReady?: boolean },
): TabApprovalValidation {
  switch (tab) {
    case 'guion':
      if ((project.script ?? '').trim().length < 20) {
        return { ok: false, message: 'Escribe al menos un párrafo de guion antes de aprobar.' };
      }
      return { ok: true };
    case 'narracion':
      if (!extras?.audioReady && !project.audioUrl) {
        return { ok: false, message: 'Genera o sube la narración antes de aprobar.' };
      }
      return { ok: true };
    case 'escenas':
      if ((project.scenes ?? []).length === 0) {
        return { ok: false, message: 'Añade o genera al menos una escena antes de aprobar.' };
      }
      return { ok: true };
    case 'subtitulos':
      if (!(extras?.subtitlesSrt ?? project.subtitlesSrt ?? '').trim()) {
        return { ok: false, message: 'Genera o escribe subtítulos antes de aprobar.' };
      }
      return { ok: true };
    case 'video':
      if (!project.videoUrl) {
        return { ok: false, message: 'Exporta o genera el video antes de aprobar esta sección.' };
      }
      return { ok: true };
    case 'thumbnail':
      if (!(project.thumbnailUrl ?? '').trim()) {
        return { ok: false, message: 'Define una miniatura antes de aprobar.' };
      }
      return { ok: true };
    case 'seo':
      if (!(project.seoDescription ?? '').trim() && (project.seoTitles ?? []).length === 0) {
        return { ok: false, message: 'Completa título o descripción SEO antes de aprobar.' };
      }
      return { ok: true };
    case 'publicacion':
      return { ok: true };
    case 'analytics':
      return { ok: true };
    default:
      return { ok: false, message: 'Sección no aprobable.' };
  }
}

export function shouldAdvanceKanban(
  tab: WorkspaceTab,
  currentStatus: ProjectStatus,
): ProjectStatus | null {
  const next = COLUMN_AFTER_TAB_APPROVE[tab];
  if (!next) return null;
  const currentIdx = stepIndex(currentStatus);
  const nextIdx = stepIndex(next);
  if (currentIdx < nextIdx) return next;
  return null;
}

export function pipelineStepForTab(tab: WorkspaceTab) {
  return PIPELINE_STEPS.find(s => s.workspaceTab === tab);
}
