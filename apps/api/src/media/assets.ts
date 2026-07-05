import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import type { Scene } from '@creator-ai-studio/shared';
import { hasBackgroundMusic, musicFilePath, MUSIC_FILENAME } from './music.js';

export type EpisodeAssetKey = 'video' | 'short' | 'thumbnail' | 'audio' | 'music' | 'content';

export interface EpisodeSceneImageInfo {
  sceneId: string;
  index: number;
  label: string;
  filename: string;
  available: boolean;
  imageUrl?: string;
  text?: string;
}

export interface EpisodeAssetInfo {
  key: EpisodeAssetKey;
  label: string;
  available: boolean;
  filename?: string;
}

const AUDIO_NAMES = ['narration.mp3', 'narration.wav', 'voiceover.mp3'] as const;

function resolveAudio(episodeDir: string): { path: string; filename: string } | null {
  for (const name of AUDIO_NAMES) {
    const candidate = path.join(episodeDir, '05-audio', name);
    if (existsSync(candidate)) {
      return { path: candidate, filename: name };
    }
  }
  return null;
}

/** Scene slide PNGs under 04-assets/ (slide-000.png …), aligned with content.scenes order. */
export function listEpisodeSceneImages(
  episodeId: string,
  episodeDir: string,
  scenes: Scene[],
): EpisodeSceneImageInfo[] {
  const assetsDir = path.join(episodeDir, '04-assets');
  return scenes.map((scene, index) => {
    const filename = `slide-${String(index).padStart(3, '0')}.png`;
    const filePath = path.join(assetsDir, filename);
    const available = existsSync(filePath);
    const imageUrl = available
      ? `/api/episodes/${episodeId}/scene-images/${filename}`
      : scene.imageUrl?.trim() || undefined;
    const text = scene.text?.trim();
    return {
      sceneId: scene.id,
      index,
      label: `Escena ${index + 1}`,
      filename,
      available,
      imageUrl,
      text: text ? text.slice(0, 160) : undefined,
    };
  });
}

export function listEpisodeAssets(episodeDir: string): EpisodeAssetInfo[] {
  const videoPath = path.join(episodeDir, '06-video', 'episode.mp4');
  const shortPath = path.join(episodeDir, '09-shorts', 'short.mp4');
  const thumbPath = path.join(episodeDir, '07-thumbnail', 'thumbnail.png');
  const contentPath = path.join(episodeDir, '00-control', 'content.json');
  const audio = resolveAudio(episodeDir);

  return [
    {
      key: 'video',
      label: 'Video (MP4)',
      available: existsSync(videoPath),
      filename: existsSync(videoPath) ? 'episode.mp4' : undefined,
    },
    {
      key: 'short',
      label: 'Short vertical (MP4)',
      available: existsSync(shortPath),
      filename: existsSync(shortPath) ? 'short.mp4' : undefined,
    },
    {
      key: 'thumbnail',
      label: 'Miniatura (PNG)',
      available: existsSync(thumbPath),
      filename: existsSync(thumbPath) ? 'thumbnail.png' : undefined,
    },
    {
      key: 'audio',
      label: 'Narración',
      available: audio !== null,
      filename: audio?.filename,
    },
    {
      key: 'music',
      label: 'Música de fondo (Lyria)',
      available: hasBackgroundMusic(episodeDir),
      filename: hasBackgroundMusic(episodeDir) ? MUSIC_FILENAME : undefined,
    },
    {
      key: 'content',
      label: 'Metadatos del episodio (JSON)',
      available: existsSync(contentPath),
      filename: existsSync(contentPath) ? 'content.json' : undefined,
    },
  ];
}

export function resolveEpisodeAssetPath(
  episodeDir: string,
  key: EpisodeAssetKey,
): { path: string; filename: string; contentType: string } | null {
  switch (key) {
    case 'video': {
      const file = path.join(episodeDir, '06-video', 'episode.mp4');
      return existsSync(file)
        ? { path: file, filename: 'episode.mp4', contentType: 'video/mp4' }
        : null;
    }
    case 'short': {
      const file = path.join(episodeDir, '09-shorts', 'short.mp4');
      return existsSync(file)
        ? { path: file, filename: 'short.mp4', contentType: 'video/mp4' }
        : null;
    }
    case 'thumbnail': {
      const file = path.join(episodeDir, '07-thumbnail', 'thumbnail.png');
      return existsSync(file)
        ? { path: file, filename: 'thumbnail.png', contentType: 'image/png' }
        : null;
    }
    case 'audio': {
      const audio = resolveAudio(episodeDir);
      if (!audio) return null;
      const contentType = audio.filename.endsWith('.wav') ? 'audio/wav' : 'audio/mpeg';
      return { path: audio.path, filename: audio.filename, contentType };
    }
    case 'music': {
      const file = musicFilePath(episodeDir);
      return existsSync(file)
        ? { path: file, filename: MUSIC_FILENAME, contentType: 'audio/mpeg' }
        : null;
    }
    case 'content': {
      const file = path.join(episodeDir, '00-control', 'content.json');
      return existsSync(file)
        ? { path: file, filename: 'content.json', contentType: 'application/json' }
        : null;
    }
    default:
      return null;
  }
}

/** Export guion as plain text for external editors. */
export async function buildScriptDownload(
  episodeDir: string,
  title: string,
  script: string,
): Promise<{ body: string; filename: string }> {
  const scriptFile = path.join(episodeDir, '02-script', 'script.md');
  if (existsSync(scriptFile)) {
    const body = await readFile(scriptFile, 'utf8');
    return { body, filename: 'script.md' };
  }
  const safeTitle = title.replace(/[^\w\s-]/g, '').trim() || 'episodio';
  return { body: script, filename: `${safeTitle}-guion.txt` };
}
