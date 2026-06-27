import type {
  AIProvider,
  ChatMessage,
  ImageOptions,
  ScriptOptions,
  SEOResult,
  TTSResult,
} from './types.js';
import { providerErrorFromResponse } from './provider-error.js';
import { getOpenAIImageModel, getOpenAIModel } from './models.js';

async function openaiChat(
  apiKey: string,
  messages: Array<{ role: string; content: string }>,
  operation: string,
): Promise<string> {
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: getOpenAIModel(),
      messages,
    }),
  });

  if (!response.ok) {
    throw await providerErrorFromResponse('openai', operation, response);
  }

  const data = (await response.json()) as {
    choices?: Array<{ message?: { content?: string } }>;
  };
  return data.choices?.[0]?.message?.content ?? '';
}

export class OpenAIProvider implements AIProvider {
  readonly name = 'openai' as const;

  constructor(private readonly apiKey: string) {}

  async chat(messages: ChatMessage[]): Promise<string> {
    return openaiChat(this.apiKey, [
      {
        role: 'system',
        content:
          'Eres el copiloto de Creator AI Studio para producción de videos cristianos. Responde en español.',
      },
      ...messages.map(m => ({ role: m.role, content: m.content })),
    ], 'chat');
  }

  async generateScript(prompt: string, options?: ScriptOptions): Promise<string> {
    const context = Object.entries(options ?? {})
      .map(([k, v]) => `${k}: ${v}`)
      .join(', ');
    return openaiChat(this.apiKey, [
      {
        role: 'user',
        content: `Escribe un guion para video cristiano de YouTube.\nPrompt: ${prompt}\nContexto: ${context}`,
      },
    ], 'script');
  }

  async rewrite(script: string, instruction: string): Promise<string> {
    return openaiChat(this.apiKey, [
      { role: 'user', content: `Reescribe este guion: "${instruction}"\n\n${script}` },
    ], 'rewrite');
  }

  async generateImage(prompt: string, _options?: ImageOptions): Promise<string> {
    const response = await fetch('https://api.openai.com/v1/images/generations', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: getOpenAIImageModel(),
        prompt,
        n: 1,
        size: '1024x1024',
      }),
    });

    if (!response.ok) {
      throw await providerErrorFromResponse('openai', 'image', response);
    }

    const data = (await response.json()) as { data?: Array<{ url?: string }> };
    return data.data?.[0]?.url ?? '';
  }

  async textToSpeech(text: string, voice: string): Promise<TTSResult> {
    const response = await fetch('https://api.openai.com/v1/audio/speech', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${this.apiKey}`,
      },
      body: JSON.stringify({
        model: 'tts-1',
        input: text.substring(0, 4096),
        voice: voice === 'masculina' ? 'onyx' : 'nova',
      }),
    });

    if (!response.ok) {
      throw await providerErrorFromResponse('openai', 'tts', response);
    }

    const buffer = await response.arrayBuffer();
    const b64 = Buffer.from(buffer).toString('base64');
    return { audio: b64 };
  }

  async optimizeSEO(title: string, script: string): Promise<SEOResult> {
    const raw = await openaiChat(this.apiKey, [
      {
        role: 'user',
        content: `SEO para YouTube. Título: ${title}. Guion: ${script.substring(0, 1500)}. JSON: {"titles":[],"description":"","tags":[]}`,
      },
    ], 'seo');
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]) as SEOResult;
    } catch {
      // fall through
    }
    return { titles: [title], description: script.substring(0, 150), tags: ['cristiano'] };
  }
}
