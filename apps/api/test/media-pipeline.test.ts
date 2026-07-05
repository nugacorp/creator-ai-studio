import { describe, expect, it } from 'vitest';
import { computeSlideDurationSeconds } from '../src/media/audio-probe.js';
import { parseScenesFromScript } from '../src/media/script-to-scenes.js';
import { chunkTextForTts, prepareScriptForTts } from '../src/media/script-for-tts.js';

const SAMPLE_SCRIPT = `**Título:** Reflexiones sobre la Creación: Génesis 1

**[INTRO - Música suave de fondo, imágenes de la naturaleza]**

**Narrador:** (Voz cálida y reflexiva)
"Hola a todos, bienvenidos a nuestro canal."

**[ESCENA 1 - Imágenes de la creación]**

**Narrador:**
"Cada vez que vemos un océano brillante, debemos recordar que todo eso es obra de un Creador amoroso."
`;

describe('parseScenesFromScript', () => {
  it('parses screenplay bracket markers into scenes', () => {
    const scenes = parseScenesFromScript(SAMPLE_SCRIPT);
    expect(scenes.length).toBeGreaterThanOrEqual(2);
    expect(scenes[0]?.text).toMatch(/naturaleza|Hola a todos/i);
  });
});

describe('prepareScriptForTts', () => {
  it('strips stage directions and keeps only spoken lines', () => {
    const out = prepareScriptForTts(SAMPLE_SCRIPT);
    expect(out).toContain('Hola a todos, bienvenidos a nuestro canal.');
    expect(out).toContain('Cada vez que vemos un océano brillante');
    expect(out).not.toContain('INTRO');
    expect(out).not.toContain('ESCENA 1');
    expect(out).not.toContain('**Narrador:**');
  });
});

describe('chunkTextForTts', () => {
  it('returns single chunk for short text', () => {
    expect(chunkTextForTts('Hola mundo.', 100)).toEqual(['Hola mundo.']);
  });

  it('splits long text at sentence boundaries', () => {
    const long = 'A. '.repeat(2000);
    const chunks = chunkTextForTts(long, 100);
    expect(chunks.length).toBeGreaterThan(1);
    for (const c of chunks) {
      expect(c.length).toBeLessThanOrEqual(100);
    }
  });
});

describe('computeSlideDurationSeconds', () => {
  it('distributes audio evenly across slides', () => {
    expect(computeSlideDurationSeconds(222, 1)).toBe(222);
    expect(computeSlideDurationSeconds(222, 5)).toBeCloseTo(44.4, 1);
  });

  it('uses fallback when audio duration unknown', () => {
    expect(computeSlideDurationSeconds(0, 3)).toBe(8);
  });
});
