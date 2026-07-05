import type {
  AIProvider,
  ChatMessage,
  ImageOptions,
  ScriptOptions,
  SEOResult,
  TTSResult,
} from './types.js';
import { providerErrorFromResponse } from './provider-error.js';
import { getAnthropicModel } from './models.js';
import { CHAT_SYSTEM_PROMPT } from './chat-scope.js';

async function claudeMessage(
  apiKey: string,
  prompt: string,
  operation: string,
  system?: string,
): Promise<string> {
  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: getAnthropicModel(),
      max_tokens: 4096,
      system: system ?? 'Eres un asistente de Creator AI Studio para videos cristianos. Responde en español.',
      messages: [{ role: 'user', content: prompt }],
    }),
  });

  if (!response.ok) {
    throw await providerErrorFromResponse('claude', operation, response);
  }

  const data = (await response.json()) as {
    content?: Array<{ type: string; text?: string }>;
  };
  return data.content?.find(c => c.type === 'text')?.text ?? '';
}

export class ClaudeAIProvider implements AIProvider {
  readonly name = 'claude' as const;

  constructor(private readonly apiKey: string) {}

  async chat(messages: ChatMessage[]): Promise<string> {
    const history = messages.map(m => `${m.role}: ${m.content}`).join('\n');
    return claudeMessage(this.apiKey, history, 'chat', CHAT_SYSTEM_PROMPT);
  }

  async generateScript(prompt: string, options?: ScriptOptions): Promise<string> {
    const ctx = JSON.stringify(options ?? {});
    return claudeMessage(
      this.apiKey,
      `Guion para video cristiano de YouTube.\nPrompt: ${prompt}\nOpciones: ${ctx}`,
      'script',
      'Eres un guionista experto en contenido cristiano.',
    );
  }

  async rewrite(script: string, instruction: string): Promise<string> {
    return claudeMessage(this.apiKey, `Reescribe aplicando "${instruction}":\n\n${script}`, 'rewrite');
  }

  async generateImage(prompt: string, _options?: ImageOptions): Promise<string> {
    return `https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&q=80&w=800&sig=${encodeURIComponent(prompt.substring(0, 20))}`;
  }

  async textToSpeech(_text: string, _voice: string): Promise<TTSResult> {
    return { isDemo: true };
  }

  async optimizeSEO(title: string, script: string): Promise<SEOResult> {
    const raw = await claudeMessage(
      this.apiKey,
      `SEO JSON para "${title}": ${script.substring(0, 1500)}. Formato: {"titles":[],"description":"","tags":[]}`,
      'seo',
    );
    try {
      const match = raw.match(/\{[\s\S]*\}/);
      if (match) return JSON.parse(match[0]) as SEOResult;
    } catch {
      // fall through
    }
    return {
      titles: [title],
      description: `Descubre ${title}: reflexión cristiana con aplicación práctica para tu vida de fe.`,
      tags: ['cristiano'],
    };
  }
}
