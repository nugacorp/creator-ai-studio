/** Extract subtitle cue text lines from SRT for timeline preview. */
export function parseSrtCueTexts(srt: string, limit = 8): string[] {
  if (!srt.trim()) return [];
  return srt
    .trim()
    .split(/\n\n+/)
    .map(block => block.split('\n').slice(2).join(' ').trim())
    .filter(Boolean)
    .slice(0, limit);
}

export function formatTimelineClock(totalSeconds: number): string {
  const safe = Number.isFinite(totalSeconds) && totalSeconds > 0 ? totalSeconds : 0;
  const m = Math.floor(safe / 60);
  const s = Math.floor(safe % 60);
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}
