import { getSecret } from '../secrets/resolver.js';

export interface ElevenLabsVoice {
  voiceId: string;
  name: string;
  category?: string;
  previewUrl?: string;
}

export interface ElevenLabsResult {
  audioUrl: string;
  isDemo: boolean;
  savedPath?: string;
}

export async function synthesizeSpeech(
  text: string,
  voiceId?: string,
  options?: { saveDir?: string },
): Promise<ElevenLabsResult> {
  const apiKey = await getSecret('ELEVENLABS_API_KEY');
  const voice =
    voiceId ??
    (await getSecret('ELEVENLABS_VOICE_ID')) ??
    '21m00Tcm4TlvDq8ikWAM';

  if (!apiKey) {
    return { audioUrl: '', isDemo: true };
  }

  const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'xi-api-key': apiKey,
    },
    body: JSON.stringify({
      text: text.substring(0, 5000),
      model_id: 'eleven_multilingual_v2',
    }),
  });

  if (!response.ok) {
    return { audioUrl: '', isDemo: true };
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (options?.saveDir) {
    const { mkdir, writeFile } = await import('node:fs/promises');
    const path = await import('node:path');
    await mkdir(options.saveDir, { recursive: true });
    const filePath = path.join(options.saveDir, 'narration.mp3');
    await writeFile(filePath, buffer);
    return {
      audioUrl: `/api/episodes/audio/narration.mp3`,
      isDemo: false,
      savedPath: filePath,
    };
  }

  const b64 = buffer.toString('base64');
  return { audioUrl: `data:audio/mpeg;base64,${b64}`, isDemo: false };
}

/** List voices from the connected ElevenLabs account (for CAS narration picker). */
export async function listElevenLabsVoices(): Promise<ElevenLabsVoice[]> {
  const apiKey = await getSecret('ELEVENLABS_API_KEY');
  if (!apiKey) return [];

  const response = await fetch('https://api.elevenlabs.io/v1/voices', {
    headers: { 'xi-api-key': apiKey },
  });
  if (!response.ok) return [];

  const data = (await response.json()) as {
    voices?: Array<{
      voice_id: string;
      name: string;
      category?: string;
      preview_url?: string;
    }>;
  };

  return (data.voices ?? []).map(v => ({
    voiceId: v.voice_id,
    name: v.name,
    category: v.category,
    previewUrl: v.preview_url,
  }));
}
