import type {
  AIProvider,
  ChatMessage,
  ImageOptions,
  ScriptOptions,
  SEOResult,
  TTSResult,
} from './types.js';
import type { GeminiAuth } from '../secrets/google-auth.js';

async function geminiGenerate(
  auth: GeminiAuth,
  model: string,
  contents: string,
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
    headers.Authorization = `Bearer ${auth.accessToken}`;
  }

  const response = await fetch(requestUrl, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    throw new Error(`Gemini API error: ${response.status}`);
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
      'gemini-2.0-flash',
      history,
      'Eres el copiloto de Creator AI Studio, un asistente para producción de videos cristianos en YouTube. Responde en español, de forma clara y práctica.',
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
      'gemini-2.0-flash',
      `Genera un guion completo para video de YouTube cristiano.\n\nPrompt: ${prompt}\n\n${opts}`,
      'Eres un guionista experto en contenido cristiano para YouTube. Escribe en español con estructura clara: gancho, desarrollo y conclusión.',
    );
  }

  async rewrite(script: string, instruction: string): Promise<string> {
    return geminiGenerate(
      this.auth,
      'gemini-2.0-flash',
      `Reescribe el siguiente guion aplicando esta instrucción: "${instruction}"\n\nGuion:\n${script}`,
    );
  }

  async generateImage(prompt: string, options?: ImageOptions): Promise<string> {
    const aspect = options?.aspectRatio ?? '16:9';
    const url =
      'https://generativelanguage.googleapis.com/v1beta/models/imagen-3.0-generate-002:predict';
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    const requestUrl =
      this.auth.mode === 'api_key'
        ? `${url}?key=${encodeURIComponent(this.auth.value)}`
        : url;
    if (this.auth.mode === 'oauth') {
      headers.Authorization = `Bearer ${this.auth.accessToken}`;
    }

    const response = await fetch(requestUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        instances: [{ prompt: `${prompt} (aspect ratio ${aspect})` }],
        parameters: { sampleCount: 1 },
      }),
    });

    if (!response.ok) {
      return `https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&q=80&w=800`;
    }

    const data = (await response.json()) as {
      predictions?: Array<{ bytesBase64Encoded?: string }>;
    };
    const b64 = data.predictions?.[0]?.bytesBase64Encoded;
    if (b64) {
      return `data:image/png;base64,${b64}`;
    }
    return `https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&q=80&w=800`;
  }

  async textToSpeech(text: string, voice: string): Promise<TTSResult> {
    try {
      const response = await geminiGenerate(
        this.auth,
        'gemini-2.0-flash',
        `Convierte a fonética legible para TTS (voz ${voice}): ${text.substring(0, 500)}`,
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
      'gemini-2.0-flash',
      `Optimiza SEO para YouTube.\nTítulo: ${title}\nGuion: ${script.substring(0, 2000)}\n\nResponde SOLO con JSON válido: {"titles":["..."],"description":"...","tags":["..."]}`,
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
      description: script.substring(0, 150),
      tags: ['reflexion', 'cristiana', 'biblia'],
    };
  }
}
