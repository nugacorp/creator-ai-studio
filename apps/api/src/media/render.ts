import { execFile } from 'node:child_process';
import { existsSync } from 'node:fs';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { promisify } from 'node:util';
import type { Scene } from '@creator-ai-studio/shared';
import { areMocksAllowed } from '../config/mocks.js';
import { computeSlideDurationSeconds, probeMediaDurationSeconds } from './audio-probe.js';

const execFileAsync = promisify(execFile);

export async function checkFfmpeg(): Promise<boolean> {
  try {
    await execFileAsync('ffmpeg', ['-version'], { timeout: 5000 });
    return true;
  } catch {
    return false;
  }
}

export async function downloadImage(url: string, dest: string): Promise<boolean> {
  try {
    if (url.startsWith('data:image')) {
      const match = url.match(/^data:image\/[^;]+;base64,(.+)$/);
      if (!match) return false;
      await writeFile(dest, Buffer.from(match[1], 'base64'));
      return true;
    }
    const res = await fetch(url);
    if (!res.ok) return false;
    await writeFile(dest, Buffer.from(await res.arrayBuffer()));
    return true;
  } catch {
    return false;
  }
}

async function resolveAudioPath(episodeDir: string): Promise<string | null> {
  for (const name of ['narration.mp3', 'narration.wav', 'voiceover.mp3']) {
    const p = path.join(episodeDir, '05-audio', name);
    if (existsSync(p)) return p;
  }
  return null;
}

async function resolveBackgroundMusicPath(episodeDir: string): Promise<string | null> {
  const p = path.join(episodeDir, '05-audio', 'background-music.mp3');
  return existsSync(p) ? p : null;
}

/** Mix narration with optional background music at ~-15 dB; returns path to use for mux. */
async function resolveMuxAudioPath(episodeDir: string, videoDir: string): Promise<string> {
  const narration = await resolveAudioPath(episodeDir);
  if (!narration) {
    throw new Error('narration missing');
  }
  const music = await resolveBackgroundMusicPath(episodeDir);
  if (!music) return narration;

  const mixed = path.join(videoDir, '_mixed-audio.mp3');
  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-i',
      narration,
      '-i',
      music,
      '-filter_complex',
      '[1:a]volume=0.18[music];[0:a][music]amix=inputs=2:duration=first:dropout_transition=2',
      '-c:a',
      'libmp3lame',
      '-q:a',
      '4',
      mixed,
    ],
    { timeout: 300_000 },
  );
  return mixed;
}

async function createPlaceholderSlide(dest: string): Promise<void> {
  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'color=c=0x1a2332:s=1920x1080:d=1',
      '-frames:v',
      '1',
      dest,
    ],
    { timeout: 30_000 },
  );
}

export interface ResolvedSlide {
  path: string;
  /** Scene timing hint in seconds (0 = distribute evenly). */
  durationHint: number;
}

function slideFilenameForIndex(index: number): string {
  return `slide-${String(index).padStart(3, '0')}.png`;
}

/** Resolve one slide per scene — prefers on-disk assets over authenticated API URLs. */
export async function resolveSceneSlides(
  episodeDir: string,
  scenes: Scene[],
): Promise<ResolvedSlide[]> {
  const assetsDir = path.join(episodeDir, '04-assets');
  await mkdir(assetsDir, { recursive: true });
  const slides: ResolvedSlide[] = [];

  for (let i = 0; i < scenes.length; i++) {
    const scene = scenes[i]!;
    const indexedPath = path.join(assetsDir, slideFilenameForIndex(i));

    if (existsSync(indexedPath)) {
      slides.push({ path: indexedPath, durationHint: scene.duration ?? 0 });
      continue;
    }

    const urlName = scene.imageUrl?.match(/(slide-\d{3}\.png)/i)?.[1];
    if (urlName) {
      const fromUrl = path.join(assetsDir, urlName);
      if (existsSync(fromUrl)) {
        slides.push({ path: fromUrl, durationHint: scene.duration ?? 0 });
        continue;
      }
    }

    const url = scene.imageUrl?.trim();
    if (
      url &&
      (url.startsWith('data:image') || url.startsWith('http://') || url.startsWith('https://'))
    ) {
      if (await downloadImage(url, indexedPath)) {
        slides.push({ path: indexedPath, durationHint: scene.duration ?? 0 });
        continue;
      }
    }

    await createPlaceholderSlide(indexedPath);
    slides.push({ path: indexedPath, durationHint: scene.duration ?? 0 });
  }

  return slides;
}

function distributeSlideDurations(
  slides: ResolvedSlide[],
  audioDuration: number,
  fallbackPerSlide: number,
): number[] {
  if (slides.length === 0) return [];
  if (audioDuration <= 0) {
    return slides.map(s => (s.durationHint > 0 ? s.durationHint : fallbackPerSlide));
  }
  const weights = slides.map(s => (s.durationHint > 0 ? s.durationHint : fallbackPerSlide));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0) || slides.length;
  return weights.map(w => Math.max(3, (w / totalWeight) * audioDuration));
}

async function buildSlideList(
  episodeDir: string,
  sceneImageUrls: string[],
  thumbnailUrl?: string,
  scenes?: Scene[],
): Promise<ResolvedSlide[]> {
  if (scenes && scenes.length > 0) {
    return resolveSceneSlides(episodeDir, scenes);
  }

  const assetsDir = path.join(episodeDir, '04-assets');
  await mkdir(assetsDir, { recursive: true });
  const slides: ResolvedSlide[] = [];

  const urls = sceneImageUrls.length > 0 ? sceneImageUrls : thumbnailUrl ? [thumbnailUrl] : [];
  let i = 0;
  for (const url of urls) {
    if (!url) continue;

    const sceneImageMatch = url.match(/\/scene-images\/(slide-\d{3}\.png)$/i);
    if (sceneImageMatch) {
      const local = path.join(episodeDir, '04-assets', sceneImageMatch[1]!);
      if (existsSync(local)) {
        slides.push({ path: local, durationHint: 0 });
        i++;
        continue;
      }
    }

    const dest = path.join(assetsDir, slideFilenameForIndex(i));
    if (await downloadImage(url, dest)) {
      slides.push({ path: dest, durationHint: 0 });
      i++;
    }
  }

  if (slides.length === 0) {
    const placeholder = path.join(assetsDir, 'slide-000.png');
    await execFileAsync(
      'ffmpeg',
      [
        '-y',
        '-f',
        'lavfi',
        '-i',
        'color=c=0x0B0F14:s=1920x1080:d=1',
        '-frames:v',
        '1',
        placeholder,
      ],
      { timeout: 30_000 },
    );
    slides.push({ path: placeholder, durationHint: 0 });
  }

  return slides;
}

export interface RenderResult {
  ok: boolean;
  videoPath?: string;
  message: string;
}

/** CPU slideshow + audio → 06-video/episode.mp4 */
export async function renderEpisodeVideo(
  episodeDir: string,
  options: {
    sceneImageUrls?: string[];
    scenes?: Scene[];
    thumbnailUrl?: string;
    secondsPerSlide?: number;
  },
): Promise<RenderResult> {
  if (!(await checkFfmpeg())) {
    return { ok: false, message: 'ffmpeg no está instalado en el servidor' };
  }

  const audioPath = await resolveAudioPath(episodeDir);
  if (!audioPath) {
    return { ok: false, message: 'Genera la narración primero (pestaña Narración)' };
  }

  const videoDir = path.join(episodeDir, '06-video');
  await mkdir(videoDir, { recursive: true });
  const outputPath = path.join(videoDir, 'episode.mp4');

  let muxAudioPath: string;
  try {
    muxAudioPath = await resolveMuxAudioPath(episodeDir, videoDir);
  } catch {
    muxAudioPath = audioPath;
  }

  const slides = await buildSlideList(
    episodeDir,
    options.sceneImageUrls ?? [],
    options.thumbnailUrl,
    options.scenes,
  );

  const audioDuration = await probeMediaDurationSeconds(audioPath);
  const fallbackPerSlide =
    options.secondsPerSlide ?? computeSlideDurationSeconds(audioDuration, slides.length);
  const slideDurations = distributeSlideDurations(slides, audioDuration, fallbackPerSlide);

  const listFile = path.join(episodeDir, '04-assets', 'ffmpeg-slides.txt');
  const listContent = slides
    .map((s, idx) => {
      const dur = slideDurations[idx] ?? fallbackPerSlide;
      return `file '${s.path.replace(/'/g, "'\\''")}'\nduration ${dur.toFixed(3)}`;
    })
    .join('\n');
  const lastSlide = slides[slides.length - 1]!;
  await writeFile(
    listFile,
    `${listContent}\nfile '${lastSlide.path.replace(/'/g, "'\\''")}'\n`,
    'utf8',
  );

  const silentVideo = path.join(videoDir, '_slides.mp4');
  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-f',
      'concat',
      '-safe',
      '0',
      '-i',
      listFile,
      '-vf',
      'scale=1920:1080:force_original_aspect_ratio=decrease,pad=1920:1080:(ow-iw)/2:(oh-ih)/2',
      '-c:v',
      'libx264',
      '-pix_fmt',
      'yuv420p',
      '-r',
      '30',
      silentVideo,
    ],
    { timeout: 600_000 },
  );

  const muxArgs = [
    '-y',
    '-i',
    silentVideo,
    '-i',
    muxAudioPath,
    '-c:v',
    'libx264',
    '-pix_fmt',
    'yuv420p',
    '-c:a',
    'aac',
    '-map',
    '0:v:0',
    '-map',
    '1:a:0',
  ];
  if (audioDuration > 0) {
    muxArgs.push('-t', audioDuration.toFixed(3));
  }
  muxArgs.push(outputPath);

  await execFileAsync('ffmpeg', muxArgs, { timeout: 600_000 });

  return {
    ok: true,
    videoPath: outputPath,
    message: `Video renderizado (${Math.round(audioDuration)}s de narración, ${slides.length} slide(s))`,
  };
}

export interface ShortsResult {
  ok: boolean;
  shortsPath?: string;
  /** All rendered short files (multi-moment pipeline). */
  rendered?: Array<{ id: string; path: string; filename: string }>;
  message: string;
}

export interface ShortRenderMoment {
  id: string;
  startTime?: number;
  durationSeconds?: number;
}

const SHORT_MAX_DURATION = 60;

/** Crop 9:16 short(s) from main episode video — one file per moment or legacy single short. */
export async function renderShortVideo(
  episodeDir: string,
  moments?: ShortRenderMoment[],
): Promise<ShortsResult> {
  if (!(await checkFfmpeg())) {
    return { ok: false, message: 'ffmpeg no está instalado' };
  }

  const input = path.join(episodeDir, '06-video', 'episode.mp4');
  if (!existsSync(input)) {
    return { ok: false, message: 'Renderiza el video largo primero' };
  }

  const shortsDir = path.join(episodeDir, '09-shorts');
  await mkdir(shortsDir, { recursive: true });

  const effectiveMoments: ShortRenderMoment[] =
    moments && moments.length > 0
      ? moments
      : [{ id: 'short-1', startTime: 0, durationSeconds: SHORT_MAX_DURATION }];

  const rendered: Array<{ id: string; path: string; filename: string }> = [];

  for (let i = 0; i < effectiveMoments.length; i++) {
    const moment = effectiveMoments[i]!;
    const index = i + 1;
    const filename = `short-${index}.mp4`;
    const outputPath = path.join(shortsDir, filename);
    const start = Math.max(0, moment.startTime ?? 0);
    const duration = Math.min(SHORT_MAX_DURATION, moment.durationSeconds ?? SHORT_MAX_DURATION);

    const args = ['-y', '-ss', String(start), '-i', input, '-t', String(duration), '-vf',
      'scale=1080:1920:force_original_aspect_ratio=increase,crop=1080:1920',
      '-c:v', 'libx264', '-c:a', 'aac', outputPath];

    await execFileAsync('ffmpeg', args, { timeout: 300_000 });
    rendered.push({ id: moment.id, path: outputPath, filename });
  }

  const legacyPath = rendered[0]?.path;
  return {
    ok: true,
    shortsPath: legacyPath,
    rendered,
    message:
      rendered.length === 1
        ? 'Short generado en 09-shorts/short-1.mp4'
        : `${rendered.length} shorts generados en 09-shorts/`,
  };
}

/** Persist thumbnail image URL to 07-thumbnail/thumbnail.png */
export async function saveThumbnailToDisk(
  episodeDir: string,
  imageUrl: string,
): Promise<string | null> {
  const thumbDir = path.join(episodeDir, '07-thumbnail');
  await mkdir(thumbDir, { recursive: true });
  const dest = path.join(thumbDir, 'thumbnail.png');
  if (await downloadImage(imageUrl, dest)) {
    return dest;
  }
  // Placeholder only in dev/demo — production must use a real image provider.
  if (areMocksAllowed() && (await checkFfmpeg())) {
    try {
      await execFileAsync(
        'ffmpeg',
        [
          '-y',
          '-f',
          'lavfi',
          '-i',
          'color=c=0x1a2332:s=1280x720:d=1',
          '-frames:v',
          '1',
          dest,
        ],
        { timeout: 30_000 },
      );
      return dest;
    } catch {
      return null;
    }
  }
  return null;
}

export async function getDirSizeBytes(dir: string): Promise<number> {
  if (!existsSync(dir)) return 0;
  const { readdir, stat } = await import('node:fs/promises');
  let total = 0;
  const entries = await readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      total += await getDirSizeBytes(full);
    } else {
      total += (await stat(full)).size;
    }
  }
  return total;
}
