import type { ProjectStatus, VideoProject } from '../types';

export type DashboardSection =
  | 'episodios-activos'
  | 'con-guion'
  | 'en-produccion'
  | 'miniaturas-listas'
  | 'programados'
  | 'publicados';

export type WorkspaceTab =
  | 'guion'
  | 'narracion'
  | 'escenas'
  | 'subtitulos'
  | 'video'
  | 'thumbnail'
  | 'seo'
  | 'publicacion'
  | 'analytics';

export const DASHBOARD_SECTION_LABELS: Record<DashboardSection, string> = {
  'episodios-activos': 'Episodios activos',
  'con-guion': 'Con guion',
  'en-produccion': 'En producción',
  'miniaturas-listas': 'Miniaturas listas',
  programados: 'Programados',
  publicados: 'Publicados',
};

const PRODUCTION_STATUSES: ProjectStatus[] = ['Narración IA', 'Edición', 'Miniatura'];

export function filterProjectsBySection(
  projects: VideoProject[],
  section: DashboardSection,
): VideoProject[] {
  switch (section) {
    case 'episodios-activos':
      return projects.filter(p => p.status !== 'Publicado');
    case 'con-guion':
      return projects.filter(p => p.script.trim().length > 20);
    case 'en-produccion':
      return projects.filter(p => PRODUCTION_STATUSES.includes(p.status));
    case 'miniaturas-listas':
      return projects.filter(p => Boolean(p.thumbnailUrl) && p.status !== 'Ideas');
    case 'programados':
      return projects.filter(p => p.status === 'Programado');
    case 'publicados':
      return projects.filter(p => p.status === 'Publicado');
  }
}

export function highlightColumnForSection(section: DashboardSection): ProjectStatus | null {
  switch (section) {
    case 'con-guion':
      return 'Guion';
    case 'en-produccion':
      return 'Narración IA';
    case 'miniaturas-listas':
      return 'Miniatura';
    case 'programados':
      return 'Programado';
    case 'publicados':
      return 'Publicado';
    default:
      return null;
  }
}

export function workspaceTabForProject(project: VideoProject, section: DashboardSection): WorkspaceTab {
  if (section === 'con-guion') return 'guion';
  if (section === 'miniaturas-listas') return 'thumbnail';
  if (section === 'en-produccion') {
    if (project.status === 'Miniatura') return 'thumbnail';
    if (project.status === 'Edición') return 'subtitulos';
    return 'narracion';
  }
  return 'guion';
}

export function shouldOpenCalendar(section: DashboardSection): boolean {
  return section === 'programados';
}
