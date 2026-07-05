import process from 'node:process';
import type {
  AIProvider,
  ChatMessage,
  ImageOptions,
  ScriptOptions,
  SEOResult,
  TTSResult,
} from './types.js';
import type { GeminiAuth } from '../secrets/google-auth.js';
import { googleOAuthHeaders } from '../secrets/google-auth.js';
import { providerErrorFromResponse, ProviderError } from './provider-error.js';
import { getGeminiImageModel, getGeminiTextModel } from './models.js';
import { areMocksAllowed } from '../config/mocks.js';
import { CHAT_SYSTEM_PROMPT } from './chat-scope.js';

async function geminiGenerate(
  auth: GeminiAuth,
  model: string,
  contents: string,
  operation: string,
  systemInstruction?: string,
): Promise<string> {
  const body: Record<string, unknown> = {
    contents: [{ parts: [{ text: contents }] }],
  };
  if (systemInstruction) {
    body.systemInstruction = { parts: [{ text: systemInstruction }] };
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
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw await providerErrorFromResponse('gemini', operation, response);
  }

  const data = (await response.json()) as {
    candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }>;
  };
  return data.candidates?.[0]?.content?.parts?.[0]?.text ?? '';
}

export class GeminiAIProvider implements AIProvider {
  readonly name = 'gemini' as const;

  constructor(private readonly auth: GeminiAuth) {}

  async chat(messages: ChatMessage[]): Promise<string> {
    const history = messages
      .map(m => `${m.role === 'user' ? 'Usuario' : 'Asistente'}: ${m.content}`)
      .join('\n');
    return geminiGenerate(
      this.auth,
      getGeminiTextModel(),
      history,
      'chat',
      CHAT_SYSTEM_PROMPT,
    );
  }

  async generateScript(prompt: string, options?: ScriptOptions): Promise<string> {
    const opts = [
      options?.theme && `Tema: ${options.theme}`,
      options?.style && `Estilo: ${options.style}`,
      options?.emotion && `Emoción: ${options.emotion}`,
      options?.audience && `Audiencia: ${options.audience}`,
      options?.duration && `Duración: ${options.duration}`,
      options?.objective && `Objetivo: ${options.objective}`,
    ]
      .filter(Boolean)
      .join('\n');

    return geminiGenerate(
      this.auth,
      getGeminiTextModel(),
      `Genera un guion completo para video de YouTube cristiano.\n\nPrompt: ${prompt}\n\n${opts}`,
      'script',
      'Eres un guionista experto en contenido cristiano para YouTube. Escribe en español con estructura clara: gancho, desarrollo y conclusión.',
    );
  }

  async rewrite(script: string, instruction: string): Promise<string> {
    return geminiGenerate(
      this.auth,
      getGeminiTextModel(),
      `Reescribe el siguiente guion aplicando esta instrucción: "${instruction}"\n\nGuion:\n${script}`,
      'rewrite',
    );
  }

  async generateImage(prompt: string, options?: ImageOptions): Promise<string> {
    const aspect = options?.aspectRatio ?? '16:9';
    const style = options?.style ? `${options.style}, ` : '';
    const englishPrompt = `${style}${prompt}`.trim();

    const models = [
      getGeminiImageModel(),
      'imagen-4.0-fast-generate-001',
      'imagen-4.0-generate-001',
    ].filter((m, i, arr) => arr.indexOf(m) === i);

    for (const model of models) {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:predict`;
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      const requestUrl =
        this.auth.mode === 'api_key'
          ? `${url}?key=${encodeURIComponent(this.auth.value)}`
          : url;
      if (this.auth.mode === 'oauth') {
        Object.assign(headers, await googleOAuthHeaders(this.auth.accessToken));
      } else {
        headers['x-goog-api-key'] = this.auth.value;
      }

      const response = await fetch(requestUrl, {
        method: 'POST',
        headers,
        body: JSON.stringify({
          instances: [{ prompt: englishPrompt }],
          parameters: { sampleCount: 1, aspectRatio: aspect },
        }),
      });

      if (!response.ok) {
        continue;
      }

      const data = (await response.json()) as {
        predictions?: Array<{ bytesBase64Encoded?: string }>;
      };
      const b64 = data.predictions?.[0]?.bytesBase64Encoded;
      if (b64) {
        return `data:image/png;base64,${b64}`;
      }
    }

    const native = await this.generateImageViaGeminiNative(englishPrompt);
    if (native) return native;

    if (!areMocksAllowed()) {
      throw new ProviderError({
        provider: 'gemini',
        operation: 'image',
        statusCode: 502,
        providerMessage:
          'No se pudo generar imagen (Imagen 4 / Gemini Image). Revisa GEMINI_API_KEY o usa OpenAI en Configuración.',
        retryable: true,
      });
    }

    return `https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&q=80&w=800&sig=${encodeURIComponent(englishPrompt.slice(0, 40))}`;
  }

  private async generateImageViaGeminiNative(prompt: string): Promise<string | null> {
    const model = process.env.GEMINI_NATIVE_IMAGE_MODEL ?? 'gemini-2.5-flash-preview-image-generation';
    const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`;
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const requestUrl =
      this.auth.mode === 'api_key'
        ? `${url}?key=${encodeURIComponent(this.auth.value)}`
        : url;
    if (this.auth.mode === 'oauth') {
      Object.assign(headers, await googleOAuthHeaders(this.auth.accessToken));
    }

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseModalities: ['IMAGE'] },
      }),
    });

    if (!response.ok) return null;

    const data = (await response.json()) as {
      candidates?: Array<{
        content?: { parts?: Array<{ inlineData?: { mimeType?: string; data?: string } }> };
      }>;
    };
    const inline = data.candidates?.[0]?.content?.parts?.find(p => p.inlineData?.data)?.inlineData;
    if (inline?.data) {
      const mime = inline.mimeType ?? 'image/png';
      return `data:${mime};base64,${inline.data}`;
    }
    return null;
  }

  async textToSpeech(text: string, voice: string): Promise<TTSResult> {
    try {
      const response = await geminiGenerate(
        this.auth,
        getGeminiTextModel(),
        `Convierte a fonética legible para TTS (voz ${voice}): ${text.substring(0, 500)}`,
        'tts',
      );
      if (response) {
        return { isDemo: true };
      }
    } catch {
      // fall through
    }
    return { isDemo: true };
  }

  async optimizeSEO(title: string, script: string): Promise<SEOResult> {
    const raw = await geminiGenerate(
      this.auth,
      getGeminiTextModel(),
      `Optimiza SEO para YouTube.\nTítulo: ${title}\nGuion: ${script.substring(0, 2000)}\n\nResponde SOLO con JSON válido: {"titles":["..."],"description":"...","tags":["..."]}`,
      'seo',
    );

    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) {
        return JSON.parse(match[0]) as SEOResult;
      }
    } catch {
      // fall through
    }

    return {
      titles: [`${title} | Reflexión Cristiana`],
      description: `Descubre ${title}: reflexión cristiana con aplicación práctica para tu vida de fe. Suscríbete y activa la campana para no perderte nuevos videos.`,
      tags: ['reflexion', 'cristiana', 'biblia'],
    };
  }
}
