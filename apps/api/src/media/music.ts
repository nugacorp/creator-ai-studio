import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Scene } from '@creator-ai-studio/shared';
import { areMocksAllowed } from '../config/mocks.js';
import {
  generateMusicWithLyria,
  type LyriaModel,
  LyriaNotConfiguredError,
} from '../integrations/lyria.js';
import { episodeFileUrl } from './media-urls.js';
import { checkFfmpeg } from './render.js';

const execFileAsync = promisify(execFile);

export const MUSIC_FILENAME = 'background-music.mp3';
export const MUSIC_META_FILENAME = 'music-meta.json';

export interface MusicMeta {
  prompt: string;
  model: string;
  generatedAt: string;
  lyrics?: string;
  label?: string;
}

export interface GenerateEpisodeMusicResult {
  musicUrl: string;
  saved: boolean;
  skipped?: boolean;
  label: string;
  meta: MusicMeta;
}

export function musicFilePath(episodeDir: string): string {
  return path.join(episodeDir, '05-audio', MUSIC_FILENAME);
}

export function musicMetaPath(episodeDir: string): string {
  return path.join(episodeDir, '05-audio', MUSIC_META_FILENAME);
}

export function hasBackgroundMusic(episodeDir: string): boolean {
  return existsSync(musicFilePath(episodeDir));
}

export function normalizePromptForComparison(prompt: string): string {
  return prompt
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Reuse existing track when prompts are identical or strongly overlapping. */
export function arePromptsSimilar(a: string, b: string): boolean {
  const na = normalizePromptForComparison(a);
  const nb = normalizePromptForComparison(b);
  if (!na || !nb) return false;
  if (na === nb) return true;
  if (na.includes(nb) || nb.includes(na)) return true;
  const wordsA = new Set(na.split(' ').filter(w => w.length > 3));
  const wordsB = new Set(nb.split(' ').filter(w => w.length > 3));
  if (wordsA.size === 0 || wordsB.size === 0) return false;
  let overlap = 0;
  for (const w of wordsA) {
    if (wordsB.has(w)) overlap++;
  }
  return overlap / Math.min(wordsA.size, wordsB.size) >= 0.7;
}

export async function readMusicMeta(episodeDir: string): Promise<MusicMeta | null> {
  const metaPath = musicMetaPath(episodeDir);
  if (!existsSync(metaPath)) return null;
  try {
    return JSON.parse(await readFile(metaPath, 'utf8')) as MusicMeta;
  } catch {
    return null;
  }
}

function deriveMusicLabel(prompt: string, meta?: MusicMeta | null): string {
  if (meta?.label?.trim()) return meta.label.trim();
  const short = prompt.trim().slice(0, 72);
  return short.length < prompt.trim().length ? `${short}…` : short;
}

/** Tiny valid silent MP3 — used when Lyria is unavailable and ffmpeg is not installed (e.g. CI). */
const MOCK_SILENT_MP3 = Buffer.from(
  'SUQzBAAAAAAAI1RTU0UAAAAPAAADTGF2ZjU4LjI3LjEwMAAAAAAAAAAAAAAA//tQxAAAAAAAAAAAAAAAAAAAAAAASW5mbwAAAA8AAAAEAAABIADAwMDAwMDAwMDAwMDAwMDAwMDAwMDAwMDVkdHIAAAAAAAAAAAAAAABMYXZmNTguNzYuMTAwAAAAAAAAAAAAAAA//tQxAADTLQ0K8AAAAzbj5b8AAAAU0xFRUAAAAOAAAB//tQxBQAAugABpAAAACAAADSAAAAEXGF2YzU4LjEzAAAAAAAAAAAAAAAAJAAAAAAAAAAAAAAB//tQxBUAAugABpAAAACAAADSAAAAAA',
  'base64',
);

async function writePlaceholderMusic(dest: string, seconds = 30): Promise<boolean> {
  if (await checkFfmpeg()) {
    try {
      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          `anullsrc=r=44100:cl=stereo`,
          '-t',
          String(seconds),
          '-c:a',
          'libmp3lame',
          '-q:a',
          '9',
          dest,
        ],
        { timeout: 60_000 },
      );
      return true;
    } catch {
      // fall through to static buffer
    }
  }
  try {
    await writeFile(dest, MOCK_SILENT_MP3);
    return true;
  } catch {
    return false;
  }
}

function defaultEpisodeMusicPrompt(title: string, script: string): string {
  const excerpt = script.replace(/\s+/g, ' ').trim().slice(0, 200);
  return (
    `Música instrumental ambiente suave para documental cristiano en español sobre "${title}". ` +
    `Sin voces, tempo medio, cuerdas y piano etéreos, mood reflexivo y esperanzador. Contexto: ${excerpt}`
  );
}

/** Assign the same music label to every scene (background bed for the episode). */
export function applyMusicLabelToScenes(scenes: Scene[], label: string): Scene[] {
  if (!label.trim()) return scenes;
  return scenes.map(s => ({ ...s, musicTrack: label }));
}

export async function generateEpisodeMusic(
  episodeId: string,
  episodeDir: string,
  options: {
    prompt?: string;
    model?: LyriaModel;
    force?: boolean;
    title?: string;
    script?: string;
  },
): Promise<GenerateEpisodeMusicResult> {
  const audioDir = path.join(episodeDir, '05-audio');
  await mkdir(audioDir, { recursive: true });

  const dest = musicFilePath(episodeDir);
  const prompt =
    options.prompt?.trim() ||
    defaultEpisodeMusicPrompt(options.title ?? 'Episodio', options.script ?? '');
  const model = options.model ?? 'lyria-3-clip-preview';
  const existingMeta = await readMusicMeta(episodeDir);

  if (!options.force && hasBackgroundMusic(episodeDir) && existingMeta) {
    if (arePromptsSimilar(prompt, existingMeta.prompt)) {
      const label = deriveMusicLabel(prompt, existingMeta);
      return {
        musicUrl: episodeFileUrl(episodeId, 'music'),
        saved: true,
        skipped: true,
        label,
        meta: existingMeta,
      };
    }
  }

  let audioBuffer: Buffer | null = null;
  let lyrics: string | undefined;
  let usedModel = model;

  try {
    const result = await generateMusicWithLyria(prompt, model);
    audioBuffer = result.audio;
    lyrics = result.lyrics;
    usedModel = result.model;
  } catch (err) {
    if (err instanceof LyriaNotConfiguredError) {
      if (!areMocksAllowed()) throw err;
      const ok = await writePlaceholderMusic(dest);
      if (!ok) throw err;
      const meta: MusicMeta = {
        prompt,
        model: 'mock-silence',
        generatedAt: new Date().toISOString(),
        label: deriveMusicLabel(prompt),
      };
      await writeFile(musicMetaPath(episodeDir), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');
      return {
        musicUrl: episodeFileUrl(episodeId, 'music'),
        saved: true,
        label: meta.label ?? deriveMusicLabel(prompt),
        meta,
      };
    }
    throw err;
  }

  await writeFile(dest, audioBuffer);
  const meta: MusicMeta = {
    prompt,
    model: usedModel,
    generatedAt: new Date().toISOString(),
    lyrics,
    label: deriveMusicLabel(prompt),
  };
  await writeFile(musicMetaPath(episodeDir), `${JSON.stringify(meta, null, 2)}\n`, 'utf8');

  return {
    musicUrl: episodeFileUrl(episodeId, 'music'),
    saved: true,
    label: meta.label ?? deriveMusicLabel(prompt),
    meta,
  };
}
