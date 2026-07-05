/**
 * Strip screenplay markup so TTS only narrates spoken lines — not stage directions.
 */
export function prepareScriptForTts(script: string): string {
  const parts: string[] = [];

  for (const rawLine of script.split('\n')) {
    const line = rawLine.trim();
    if (!line) continue;

    // Skip bracketed stage directions: **[INTRO - ...]**, **[ESCENA 1 - ...]**
    if (/^\*\*\[[^\]]+\]\*\*$/i.test(line)) continue;
    if (/^\[[^\]]+\]$/i.test(line)) continue;

    // Skip metadata headers
    if (/^\*\*Título:\*\*/i.test(line)) continue;
    if (/^#{1,3}\s/.test(line)) continue;

    // Quoted narrator speech: "Hola a todos..."
    const quoteMatches = line.matchAll(/"([^"]+)"/g);
    let foundQuote = false;
    for (const m of quoteMatches) {
      const text = m[1]?.trim();
      if (text) {
        parts.push(text);
        foundQuote = true;
      }
    }
    if (foundQuote) continue;

    // **Narrador:** line (with or without parenthetical voice note)
    const narrator = line
      .replace(/^\*\*Narrador:\*\*\s*/i, '')
      .replace(/^\(Voz[^)]*\)\s*/i, '')
      .replace(/\*\*/g, '')
      .trim();

    if (narrator && !/^\[/.test(narrator)) {
      parts.push(narrator);
    }
  }

  return parts.join(' ').replace(/\s+/g, ' ').trim();
}

/** Split long narration into ElevenLabs-safe chunks (sentence boundaries). */
export function chunkTextForTts(text: string, maxLen = 4500): string[] {
  const normalized = text.replace(/\s+/g, ' ').trim();
  if (normalized.length <= maxLen) return [normalized];

  const chunks: string[] = [];
  let rest = normalized;

  while (rest.length > maxLen) {
    const slice = rest.slice(0, maxLen);
    const breakAt = Math.max(
      slice.lastIndexOf('. '),
      slice.lastIndexOf('? '),
      slice.lastIndexOf('! '),
      slice.lastIndexOf('; '),
    );
    const cut = breakAt > maxLen * 0.5 ? breakAt + 1 : maxLen;
    chunks.push(rest.slice(0, cut).trim());
    rest = rest.slice(cut).trim();
  }
  if (rest) chunks.push(rest);
  return chunks;
}
