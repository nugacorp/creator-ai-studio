import { getGeminiAuth, googleOAuthHeaders } from '../secrets/google-auth.js';
import { providerErrorFromResponse } from '../ai/provider-error.js';

export type LyriaModel = 'lyria-3-clip-preview' | 'lyria-3-pro-preview';

export const LYRIA_MODELS: LyriaModel[] = ['lyria-3-clip-preview', 'lyria-3-pro-preview'];

export interface GenerateMusicResult {
  audio: Buffer;
  mimeType: string;
  lyrics?: string;
  model: LyriaModel;
}

export class LyriaNotConfiguredError extends Error {
  constructor() {
    super(
      'LYRIA_NOT_CONFIGURED: Configura GEMINI_API_KEY o conecta Google OAuth (Gemini) en Ajustes. Lyria requiere acceso a la Generative Language API.',
    );
    this.name = 'LyriaNotConfiguredError';
  }
}

/** Generate stereo MP3 via Google Lyria (Gemini API generateContent). */
export async function generateMusicWithLyria(
  prompt: string,
  model: LyriaModel = 'lyria-3-clip-preview',
): Promise<GenerateMusicResult> {
  const auth = await getGeminiAuth();
  if (!auth) {
    throw new LyriaNotConfiguredError();
  }

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
  const headers: Record<string, string> = { 'Content-Type': 'application/json' };
  const requestUrl =
    auth.mode === 'api_key' ? `${url}?key=${encodeURIComponent(auth.value)}` : url;
  if (auth.mode === 'oauth') {
    Object.assign(headers, await googleOAuthHeaders(auth.accessToken));
  }

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify({
      contents: [{ parts: [{ text: prompt }] }],
    }),
  });

  if (!response.ok) {
    throw await providerErrorFromResponse('gemini', 'music', response);
  }

  const data = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
          inlineData?: { mimeType?: string; data?: string };
        }>;
      };
    }>;
  };

  let lyrics = '';
  let audioB64: string | undefined;
  let mimeType = 'audio/mpeg';

  for (const part of data.candidates?.[0]?.content?.parts ?? []) {
    if (part.text) lyrics += part.text;
    if (part.inlineData?.data) {
      audioB64 = part.inlineData.data;
      mimeType = part.inlineData.mimeType ?? mimeType;
    }
  }

  if (!audioB64) {
    throw new Error(
      'LYRIA_NO_AUDIO: La API no devolvió audio. Verifica que Lyria esté habilitado en tu cuenta Gemini.',
    );
  }

  return {
    audio: Buffer.from(audioB64, 'base64'),
    mimeType,
    lyrics: lyrics.trim() || undefined,
    model,
  };
}
