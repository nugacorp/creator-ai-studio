import { describe, it, expect } from 'vitest';
import { buildAgentSystemPrompt, mergeAgentSkills } from '../src/agents/overrides.js';

describe('agent overrides', () => {
  it('buildAgentSystemPrompt appends skills, prompt and notes', () => {
    const result = buildAgentSystemPrompt('Base prompt.', {
      extraSkills: ['tono pastoral', 'español latino'],
      promptAppend: 'Usa párrafos cortos.',
      customNotes: 'Canal: Reflexiones Bíblicas.',
    });
    expect(result).toContain('Base prompt.');
    expect(result).toContain('Additional expertise:');
    expect(result).toContain('- tono pastoral');
    expect(result).toContain('Usa párrafos cortos.');
    expect(result).toContain('Creator notes:');
    expect(result).toContain('Canal: Reflexiones Bíblicas.');
  });

  it('mergeAgentSkills returns base when no extras', () => {
    expect(mergeAgentSkills(['a', 'b'], {})).toEqual(['a', 'b']);
    expect(mergeAgentSkills(['a'], { extraSkills: ['c'] })).toEqual(['a', 'c']);
  });
});
