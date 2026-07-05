import { describe, it, expect } from 'vitest';
import { DemoAIProvider } from '../src/ai/demo.js';

describe('DemoAIProvider.optimizeSEO', () => {
  it('returns YouTube metadata instead of a script excerpt', async () => {
    const provider = new DemoAIProvider();
    const script = '# David vs Goliat\n\n## Introducción\nBienvenidos a una nueva reflexión.';
    const result = await provider.optimizeSEO('David vs Goliat', script);

    expect(result.titles.length).toBeGreaterThan(0);
    expect(result.description).not.toBe(script.substring(0, 80));
    expect(result.description).toContain('David vs Goliat');
    expect(result.tags.length).toBeGreaterThan(0);
  });
});
