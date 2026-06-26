import type { TtsProvider } from '@creator-ai-studio/shared';
import { getSettings } from '../settings/store.js';
import { synthesizeSpeech } from './elevenlabs.js';
import { synthesizeWithPiper } from './piper.js';
import { withProvider } from '../ai/router.js';

export interface TtsRequest {
  text: string;
  voiceId?: string;
  provider?: TtsProvider;
  saveDir?: string;
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
    const result = await synthesizeSpeech(req.text, req.voiceId, { saveDir: req.saveDir });
    return { ...result, provider: 'elevenlabs', audioUrl: result.audioUrl || '' };
  }

  if (provider === 'piper') {
    const result = await synthesizeWithPiper(req.text, { saveDir: req.saveDir });
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
          audioUrl: '/api/episodes/audio/narration.mp3',
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
