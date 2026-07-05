import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { EpisodeContent, Scene } from '@creator-ai-studio/shared';

function formatSrtTime(seconds: number): string {
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.floor(seconds % 60);
  const ms = Math.round((seconds % 1) * 1000);
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')},${String(ms).padStart(3, '0')}`;
}

function wrapCueText(text: string, maxLen = 42): string {
  const words = text.split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let line = '';
  for (const word of words) {
    const next = line ? `${line} ${word}` : word;
    if (next.length > maxLen && line) {
      lines.push(line);
      line = word;
    } else {
      line = next;
    }
  }
  if (line) lines.push(line);
  return lines.join('\n');
}

function cuesFromScenes(scenes: Scene[]): string[] {
  let cursor = 0;
  const cues: string[] = [];
  let index = 1;

  for (const scene of scenes) {
    const text = (scene.voiceoverPrompt || scene.text || '').trim();
    if (!text) continue;
    const duration = Math.max(2, scene.duration || 5);
    const start = cursor;
    const end = cursor + duration;
    cursor = end;
    cues.push(
      `${index}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${wrapCueText(text)}`,
    );
    index += 1;
  }

  return cues;
}

function cuesFromScript(script: string): string[] {
  const paragraphs = script
    .split(/\n{2,}/)
    .map(p => p.replace(/\*\*\[[^\]]+\]\*\*/g, '').trim())
    .filter(p => p.length > 0);

  let cursor = 0;
  const cues: string[] = [];
  let index = 1;
  const wordsPerSecond = 2.5;

  for (const paragraph of paragraphs) {
    const duration = Math.max(3, paragraph.split(/\s+/).length / wordsPerSecond);
    const start = cursor;
    const end = cursor + duration;
    cursor = end;
    cues.push(
      `${index}\n${formatSrtTime(start)} --> ${formatSrtTime(end)}\n${wrapCueText(paragraph)}`,
    );
    index += 1;
  }

  return cues;
}

/** Build SRT subtitles from scene timings or script paragraphs. */
export function generateSubtitlesSrt(content: EpisodeContent): string {
  const fromScenes = cuesFromScenes(content.scenes ?? []);
  const cues = fromScenes.length > 0 ? fromScenes : cuesFromScript(content.script ?? '');
  return cues.join('\n\n');
}

export async function writeSubtitlesFile(
  episodeDir: string,
  srt: string,
): Promise<string> {
  const dir = path.join(episodeDir, '06-subtitles');
  const filePath = path.join(dir, 'subtitles.srt');
  await writeFile(filePath, `${srt.trim()}\n`, 'utf8');
  return filePath;
}
