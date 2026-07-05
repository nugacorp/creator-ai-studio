import type { Scene } from '@creator-ai-studio/shared';

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

/**
 * Parse screenplay-style scripts into storyboard scenes.
 * Handles `**[ESCENA 1 - ...]**` blocks and falls back to paragraph splits.
 */
export function parseScenesFromScript(script: string): Scene[] {
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

      scenes.push({
        id: `scene-${i + 1}`,
        text: visual ? `${visual}${narration ? ` — ${narration.slice(0, 180)}` : ''}` : narration.slice(0, 280),
        imageUrl: '',
        voiceoverPrompt: narration.slice(0, 240),
        musicTrack: /música|musica/i.test(label) ? 'ambient-soft' : '',
        duration: Math.max(6, Math.min(20, Math.ceil((narration.length || 80) / 14))),
        transition: 'Fade',
      });
    }
    if (scenes.length > 0) return scenes;
  }

  const paragraphs = trimmed
    .split(/\n\n+/)
    .map(p => p.trim())
    .filter(p => p.length > 20 && !/^\*\*Título:/i.test(p));

  const chunks = paragraphs.length > 0 ? paragraphs : [trimmed.slice(0, 500)];
  return chunks.slice(0, 12).map((text, i) => ({
    id: `scene-${i + 1}`,
    text: extractNarration(text).slice(0, 280) || text.slice(0, 280),
    imageUrl: '',
    voiceoverPrompt: extractNarration(text).slice(0, 240),
    musicTrack: '',
    duration: 10,
    transition: 'Fade',
  }));
}
