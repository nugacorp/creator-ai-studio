import { describe, it, expect } from 'vitest';
import { agentDisplayName, agentsForStep, pipelineStepForAgent, stepForColumn } from '../src/lib/projectPipeline';

describe('projectPipeline agent display', () => {
  it('shows friendly name for shorts_agent in Edición column', () => {
    const edition = stepForColumn('Edición');
    const ids = agentsForStep(edition);
    expect(ids).toContain('shorts_agent');
    expect(agentDisplayName('shorts_agent')).toBe('Agente de Shorts');
  });

  it('resolves primary column agent names', () => {
    expect(agentDisplayName('video_editor')).toBe('Editor de Video');
    expect(agentDisplayName('seo_optimizer')).toBe('Optimizador SEO');
  });

  it('maps shorts_agent to Edición Kanban column', () => {
    expect(pipelineStepForAgent('shorts_agent')?.column).toBe('Edición');
  });
});
