import { describe, it, expect } from 'vitest';
import { buildYouTubeDescription } from '../src/seo/description.js';

describe('buildYouTubeDescription', () => {
  it('appends chapter block when not present', () => {
    const result = buildYouTubeDescription('Descripción base.', [
      { time: '00:00', title: 'Intro' },
      { time: '02:30', title: 'Versículo clave' },
    ]);
    expect(result).toContain('Descripción base.');
    expect(result).toContain('00:00 Intro');
    expect(result).toContain('02:30 Versículo clave');
  });

  it('does not duplicate chapters already in description', () => {
    const base = 'Texto\n\nCapítulos:\n00:00 Intro';
    const result = buildYouTubeDescription(base, [{ time: '00:00', title: 'Intro' }]);
    expect(result).toBe(base);
  });
});
