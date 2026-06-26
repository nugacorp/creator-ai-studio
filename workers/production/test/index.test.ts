import { describe, it, expect } from 'vitest';
import { getReadyMessage } from '../src/index.js';

describe('production worker', () => {
  it('reports the ready message', () => {
    expect(getReadyMessage()).toBe('Creator AI Studio production worker ready.');
  });
});
