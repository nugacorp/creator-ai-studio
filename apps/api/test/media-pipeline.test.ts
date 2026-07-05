import { describe, expect, it } from 'vitest';
import { computeSlideDurationSeconds } from '../src/media/audio-probe.js';
import { buildSceneImagePrompt, extractSceneVisualParts } from '../src/media/scene-image-prompt.js';
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

describe('buildSceneImagePrompt', () => {
  it('builds distinct English prompts per scene index', () => {
    const a = buildSceneImagePrompt({ text: 'océanos y montañas', voiceoverPrompt: 'texto narrado' }, 0, 'Génesis');
    const b = buildSceneImagePrompt({ text: 'comunidades ayudándose', voiceoverPrompt: 'otro texto' }, 1, 'Génesis');
    expect(a).toContain('Scene 1');
    expect(b).toContain('Scene 2');
    expect(a).not.toEqual(b);
    expect(a).toMatch(/ocean|mountain|forest|nature|creation/i);
  });

  it('does not copy narration or greetings into the image prompt', () => {
    const prompt = buildSceneImagePrompt(
      {
        text: 'Música suave de fondo, imágenes de la naturaleza',
        voiceoverPrompt: 'Hola a todos, bienvenidos a nuestro canal. Hoy nos adentraremos en Génesis.',
        visualNote: 'Música suave de fondo, imágenes de la naturaleza',
      },
      0,
      'Génesis — El comienzo de todo',
    );
    expect(prompt).not.toMatch(/hola a todos|bienvenidos|nuestro canal/i);
    expect(prompt).not.toMatch(/música|musica de fondo/i);
    expect(prompt).toMatch(/forest|nature|golden hour|creation|genesis/i);
  });

  it('uses stored imagePrompt when present', () => {
    const custom = 'Aerial shot of ancient olive grove at sunset, cinematic 16:9';
    expect(buildSceneImagePrompt({ text: 'ignored', imagePrompt: custom }, 0)).toBe(custom);
  });
});

describe('extractSceneVisualParts', () => {
  it('separates visual note from narration', () => {
    const parts = extractSceneVisualParts({
      text: 'Bosque al amanecer — Hola a todos',
      voiceoverPrompt: 'Hola a todos, bienvenidos',
      visualNote: 'Bosque al amanecer con niebla',
    });
    expect(parts.visualSpanish).toContain('Bosque');
    expect(parts.moodHint).not.toMatch(/hola a todos/i);
  });
});

describe('parseScenesFromScript', () => {
  it('parses screenplay bracket markers into scenes', () => {
    const scenes = parseScenesFromScript(SAMPLE_SCRIPT, 'Génesis 1');
    expect(scenes.length).toBeGreaterThanOrEqual(2);
    expect(scenes[0]?.voiceoverPrompt).toMatch(/Hola a todos/i);
    expect(scenes[0]?.text).not.toMatch(/Hola a todos/i);
    expect(scenes[0]?.imagePrompt).toBeTruthy();
    expect(scenes[0]?.imagePrompt).not.toMatch(/hola a todos/i);
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
