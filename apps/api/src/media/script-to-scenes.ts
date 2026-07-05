import type { Scene } from '@creator-ai-studio/shared';
import { buildSceneImagePrompt } from './scene-image-prompt.js';

const STAGE_MARKERS = /\*\*\[([^\]]+)\]\*\*/g;

function extractNarration(block: string): string {
  const quotes = [...block.matchAll(/"([^"]+)"/g)].map(m => m[1]?.trim()).filter(Boolean);
  if (quotes.length > 0) return quotes.join(' ');

  return block
    .replace(/^\*\*Narrador:\*\*\s*/gim, '')
    .replace(/^\(Voz[^)]*\)\s*/gim, '')
    .replace(/\*\*/g, '')
    .replace(/\n+/g, ' ')
    .trim();
}

function visualFromLabel(label: string): string {
  return label
    .replace(/^(INTRO|TRANSICIÓN|TRANSICION|ESCENA\s*\d+|CONCLUSIÓN|CONCLUSION|FINAL|MÚSICA|MUSICA)\s*[-–:]\s*/i, '')
    .trim();
}

function buildScene(
  index: number,
  visual: string,
  narration: string,
  label: string,
  episodeHint?: string,
): Scene {
  const visualNote = visual.trim();
  const voiceover = narration.trim();
  const sceneInput = { text: visualNote, voiceoverPrompt: voiceover, visualNote };

  return {
    id: `scene-${index + 1}`,
    text: visualNote || voiceover.slice(0, 120),
    imageUrl: '',
    voiceoverPrompt: voiceover.slice(0, 240),
    visualNote: visualNote || undefined,
    imagePrompt: buildSceneImagePrompt(sceneInput, index, episodeHint),
    musicTrack: /música|musica/i.test(label) ? 'ambient-soft' : '',
    duration: Math.max(6, Math.min(20, Math.ceil((voiceover.length || 80) / 14))),
    transition: 'Fade',
  };
}

/**
 * Parse screenplay-style scripts into storyboard scenes.
 * Handles `**[ESCENA 1 - ...]**` blocks and falls back to paragraph splits.
 */
export function parseScenesFromScript(script: string, episodeTitle?: string): Scene[] {
  const trimmed = script.trim();
  if (!trimmed) return [];

  const markers = [...trimmed.matchAll(STAGE_MARKERS)];
  if (markers.length > 0) {
    const scenes: Scene[] = [];
    for (let i = 0; i < markers.length; i++) {
      const match = markers[i]!;
      const label = match[1] ?? `Escena ${i + 1}`;
      const start = (match.index ?? 0) + match[0].length;
      const end = i + 1 < markers.length ? markers[i + 1]!.index! : trimmed.length;
      const body = trimmed.slice(start, end);
      const narration = extractNarration(body);
      const visual = visualFromLabel(label);
      if (!narration && !visual) continue;

      scenes.push(buildScene(i, visual, narration, label, episodeTitle));
    }
    if (scenes.length > 0) return scenes;
  }

  const paragraphs = trimmed
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 20 && !/^\*\*Título:/i.test(p));

  const chunks = paragraphs.length > 0 ? paragraphs : [trimmed.slice(0, 500)];
  return chunks.slice(0, 12).map((text, i) => {
    const narration = extractNarration(text);
    return buildScene(i, '', narration || text.slice(0, 120), '', episodeTitle);
  });
}
