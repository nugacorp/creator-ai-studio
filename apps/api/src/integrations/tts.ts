import type { TtsProvider } from '@creator-ai-studio/shared';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { withProvider } from '../ai/router.js';
import { areMocksAllowed } from '../config/mocks.js';
import { getSettings } from '../settings/store.js';
import { synthesizeSpeech } from './elevenlabs.js';
import { synthesizeWithPiper } from './piper.js';
import { episodeFileUrl } from '../media/media-urls.js';

const execFileAsync = promisify(execFile);

/** Placeholder narration so render/ffmpeg can run in local demo mode. */
async function writeDemoSilentAudio(saveDir: string, seconds = 8): Promise<string> {
  const pathMod = await import('node:path');
  const { mkdir } = await import('node:fs/promises');
  await mkdir(saveDir, { recursive: true });
  const filePath = pathMod.join(saveDir, 'narration.mp3');
  await execFileAsync(
    'ffmpeg',
    [
      '-y',
      '-f',
      'lavfi',
      '-i',
      'anullsrc=r=24000:cl=mono',
      '-t',
      String(seconds),
      '-c:a',
      'libmp3lame',
      '-q:a',
      '9',
      filePath,
    ],
    { timeout: 30_000 },
  );
  return filePath;
}

export interface TtsRequest {
  text: string;
  voiceId?: string;
  provider?: TtsProvider;
  saveDir?: string;
  episodeId?: string;
}

export interface TtsResponse {
  audioUrl: string;
  isDemo: boolean;
  provider: TtsProvider;
  savedPath?: string;
}

export async function synthesizeEpisodeSpeech(req: TtsRequest): Promise<TtsResponse> {
  const settings = await getSettings();
  const provider = req.provider ?? settings.ttsProvider ?? 'elevenlabs';

  if (provider === 'elevenlabs') {
    const result = await synthesizeSpeech(req.text, req.voiceId, {
      saveDir: req.saveDir,
      episodeId: req.episodeId,
    });
    if (result.isDemo && req.saveDir && areMocksAllowed()) {
      const savedPath = await writeDemoSilentAudio(req.saveDir);
      return {
        audioUrl: req.episodeId ? episodeFileUrl(req.episodeId, 'audio') : '',
        isDemo: true,
        provider: 'elevenlabs',
        savedPath,
      };
    }
    return { ...result, provider: 'elevenlabs', audioUrl: result.audioUrl || '' };
  }

  if (provider === 'piper') {
    const result = await synthesizeWithPiper(req.text, {
      saveDir: req.saveDir,
      episodeId: req.episodeId,
    });
    return { ...result, provider: 'piper', audioUrl: result.audioUrl || '' };
  }

  const tts = await withProvider('tts', p => p.textToSpeech(req.text, req.voiceId ?? 'default'));
  if (tts.audio) {
    const audioUrl = tts.audio.startsWith('data:')
      ? tts.audio
      : `data:audio/mpeg;base64,${tts.audio}`;
    if (req.saveDir) {
      const { mkdir, writeFile } = await import('node:fs/promises');
      const pathMod = await import('node:path');
      await mkdir(req.saveDir, { recursive: true });
      const match = audioUrl.match(/^data:audio\/[^;]+;base64,(.+)$/);
      if (match) {
        const filePath = pathMod.join(req.saveDir, 'narration.mp3');
        await writeFile(filePath, Buffer.from(match[1], 'base64'));
        return {
          audioUrl: req.episodeId ? episodeFileUrl(req.episodeId, 'audio') : '',
          isDemo: false,
          provider: 'gemini',
          savedPath: filePath,
        };
      }
    }
    return { audioUrl, isDemo: tts.isDemo ?? false, provider: 'gemini' };
  }

  return { audioUrl: '', isDemo: true, provider };
}
