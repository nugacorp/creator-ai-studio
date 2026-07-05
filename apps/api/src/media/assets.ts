import { existsSync } from 'node:fs';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

export type EpisodeAssetKey = 'video' | 'short' | 'thumbnail' | 'audio' | 'content';

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
