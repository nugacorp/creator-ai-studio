import type { SeoChapter } from '@creator-ai-studio/shared';

/** Append YouTube chapter markers (00:00 Title) when not already present. */
export function buildYouTubeDescription(
  baseDescription: string,
  chapters?: SeoChapter[],
): string {
  const trimmed = baseDescription.trim();
  if (!chapters?.length) return trimmed;

  const lines = chapters
    .filter(ch => ch.time?.trim() && ch.title?.trim())
    .map(ch => `${ch.time.trim()} ${ch.title.trim()}`);
  if (lines.length === 0) return trimmed;

  const firstLine = lines[0]!;
  if (trimmed.includes(firstLine)) return trimmed;

  return `${trimmed}\n\nCapítulos:\n${lines.join('\n')}`;
}
