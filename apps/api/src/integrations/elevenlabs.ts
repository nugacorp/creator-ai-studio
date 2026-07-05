import process from 'node:process';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { getSecret } from '../secrets/resolver.js';
import { episodeFileUrl } from '../media/media-urls.js';
import { chunkTextForTts, prepareScriptForTts } from '../media/script-for-tts.js';

const execFileAsync = promisify(execFile);

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

async function synthesizeChunk(
  apiKey: string,
  voice: string,
  modelId: string,
  text: string,
): Promise<Buffer> {
  const url = new URL(`${ELEVENLABS_API_BASE}/v1/text-to-speech/${voice}`);
  url.searchParams.set('output_format', 'mp3_44100_128');

  const response = await fetch(url, {
    method: 'POST',
    headers: elevenLabsHeaders(apiKey),
    body: JSON.stringify({
      text,
      model_id: modelId,
    }),
  });

  if (!response.ok) {
    throw new ElevenLabsApiError(await parseApiError(response), response.status);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function concatMp3Buffers(buffers: Buffer[], saveDir?: string): Promise<Buffer> {
  if (buffers.length === 1) return buffers[0]!;

  const pathMod = await import('node:path');
  const { mkdir, writeFile, readFile, rm } = await import('node:fs/promises');
  const tmpDir = saveDir
    ? pathMod.join(saveDir, '_tts_chunks')
    : pathMod.join(process.cwd(), '.tmp-tts-chunks');
  await mkdir(tmpDir, { recursive: true });

  const listFile = pathMod.join(tmpDir, 'concat.txt');
  const chunkPaths: string[] = [];
  for (let i = 0; i < buffers.length; i++) {
    const p = pathMod.join(tmpDir, `chunk-${i}.mp3`);
    await writeFile(p, buffers[i]!);
    chunkPaths.push(p);
  }
  const listContent = chunkPaths.map(p => `file '${p.replace(/'/g, "'\\''")}'`).join('\n');
  await writeFile(listFile, listContent, 'utf8');

  const outPath = pathMod.join(tmpDir, 'merged.mp3');
  await execFileAsync(
    'ffmpeg',
    ['-y', '-f', 'concat', '-safe', '0', '-i', listFile, '-c', 'copy', outPath],
    { timeout: 120_000 },
  );
  const merged = await readFile(outPath);
  await rm(tmpDir, { recursive: true, force: true }).catch(() => undefined);
  return merged;
}

export async function synthesizeSpeech(
  text: string,
  voiceId?: string,
  options?: { saveDir?: string; episodeId?: string },
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

  const narration = prepareScriptForTts(text);
  const spoken = narration || text.trim();
  if (!spoken) {
    throw new ElevenLabsApiError('El guion no tiene texto narrable para TTS', 400);
  }

  const chunks = chunkTextForTts(spoken);
  const buffers: Buffer[] = [];
  for (const chunk of chunks) {
    buffers.push(await synthesizeChunk(apiKey, voice, modelId, chunk));
  }
  const buffer = await concatMp3Buffers(buffers, options?.saveDir);

  if (options?.saveDir) {
    const { mkdir, writeFile } = await import('node:fs/promises');
    const path = await import('node:path');
    await mkdir(options.saveDir, { recursive: true });
    const filePath = path.join(options.saveDir, 'narration.mp3');
    await writeFile(filePath, buffer);
    return {
      audioUrl: options.episodeId ? episodeFileUrl(options.episodeId, 'audio') : '',
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
