import { describe, it, expect } from 'vitest';
import {
  filterProjectsBySection,
  highlightColumnForSection,
  workspaceTabForProject,
  shouldOpenCalendar,
} from '../src/lib/dashboardNavigation';
import type { VideoProject } from '../src/types';

const base = (overrides: Partial<VideoProject>): VideoProject => ({
  id: 'p1',
  title: 'Test',
  series: 'Reflexiones',
  status: 'Guion',
  progress: 35,
  script: 'Guion largo de prueba con contenido',
  outline: [],
  scenes: [],
  seoTitles: [],
  seoDescription: '',
  seoTags: [],
  duration: '05:00',
  ...overrides,
});

describe('dashboardNavigation', () => {
  it('filters projects by section', () => {
    const projects = [
      base({ id: 'a', status: 'Guion' }),
      base({ id: 'b', status: 'Publicado', script: '' }),
      base({ id: 'c', status: 'Miniatura', thumbnailUrl: 'https://example.com/t.jpg' }),
    ];
    expect(filterProjectsBySection(projects, 'episodios-activos')).toHaveLength(2);
    expect(filterProjectsBySection(projects, 'con-guion')).toHaveLength(2);
    expect(filterProjectsBySection(projects, 'publicados')).toHaveLength(1);
  });

  it('maps sections to pipeline columns', () => {
    expect(highlightColumnForSection('con-guion')).toBe('Guion');
    expect(highlightColumnForSection('miniaturas-listas')).toBe('Miniatura');
  });

  it('opens calendar only for programados', () => {
    expect(shouldOpenCalendar('programados')).toBe(true);
    expect(shouldOpenCalendar('publicados')).toBe(false);
  });

  it('picks workspace tab from production status', () => {
    expect(workspaceTabForProject(base({ status: 'Edición' }), 'en-produccion')).toBe('video');
    expect(workspaceTabForProject(base({ status: 'Miniatura' }), 'en-produccion')).toBe('thumbnail');
  });
});
