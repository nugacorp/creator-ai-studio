import process from 'node:process';
import { getSecret } from '../secrets/resolver.js';

/** Default voice from ElevenLabs quickstart (George). */
export const ELEVENLABS_DEFAULT_VOICE_ID = 'JBFqnCBsd6RMkjVDRZzb';

/** Default TTS model — multilingual for Spanish/English narration. */
export const ELEVENLABS_DEFAULT_MODEL_ID = 'eleven_multilingual_v2';

const ELEVENLABS_API_BASE = 'https://api.elevenlabs.io';

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

export class ElevenLabsApiError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ElevenLabsApiError';
    this.status = status;
  }
}

function elevenLabsHeaders(apiKey: string): Record<string, string> {
  return {
    'Content-Type': 'application/json',
    Accept: 'audio/mpeg',
    'xi-api-key': apiKey,
  };
}

async function parseApiError(response: Response): Promise<string> {
  try {
    const data = (await response.json()) as {
      detail?: { message?: string; status?: string } | string;
      message?: string;
    };
    if (typeof data.detail === 'object' && data.detail?.message) {
      return data.detail.message;
    }
    if (typeof data.detail === 'string') return data.detail;
    if (data.message) return data.message;
  } catch {
    // Response body was not JSON.
  }
  return `ElevenLabs respondió ${response.status}`;
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
    ELEVENLABS_DEFAULT_VOICE_ID;
  const modelId =
    (await getSecret('ELEVENLABS_MODEL_ID')) ??
    process.env.ELEVENLABS_MODEL_ID ??
    ELEVENLABS_DEFAULT_MODEL_ID;

  if (!apiKey) {
    return { audioUrl: '', isDemo: true };
  }

  const url = new URL(`${ELEVENLABS_API_BASE}/v1/text-to-speech/${voice}`);
  url.searchParams.set('output_format', 'mp3_44100_128');

  const response = await fetch(url, {
    method: 'POST',
    headers: elevenLabsHeaders(apiKey),
    body: JSON.stringify({
      text: text.substring(0, 5000),
      model_id: modelId,
    }),
  });

  if (!response.ok) {
    throw new ElevenLabsApiError(await parseApiError(response), response.status);
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

  const voices: ElevenLabsVoice[] = [];
  let nextPageToken: string | null = null;

  do {
    const url = new URL(`${ELEVENLABS_API_BASE}/v2/voices`);
    url.searchParams.set('page_size', '100');
    if (nextPageToken) {
      url.searchParams.set('next_page_token', nextPageToken);
    }

    const response = await fetch(url, {
      headers: { 'xi-api-key': apiKey },
    });
    if (!response.ok) {
      return voices;
    }

    const data = (await response.json()) as {
      voices?: Array<{
        voice_id: string;
        name: string;
        category?: string;
        preview_url?: string;
      }>;
      has_more?: boolean;
      next_page_token?: string | null;
    };

    for (const v of data.voices ?? []) {
      voices.push({
        voiceId: v.voice_id,
        name: v.name,
        category: v.category,
        previewUrl: v.preview_url,
      });
    }

    nextPageToken = data.has_more ? (data.next_page_token ?? null) : null;
  } while (nextPageToken);

  return voices;
}
