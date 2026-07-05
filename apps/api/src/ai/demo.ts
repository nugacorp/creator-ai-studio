import type {
  AIProvider,
  ChatMessage,
  ImageOptions,
  ScriptOptions,
  SEOResult,
  TTSResult,
} from './types.js';

const DEMO_IMAGE =
  'https://images.unsplash.com/photo-1499209974431-9dddcece7f88?auto=format&fit=crop&q=80&w=800';

/** Fallback provider when no API keys are configured. */
export class DemoAIProvider implements AIProvider {
  readonly name = 'demo' as const;

  async chat(messages: ChatMessage[]): Promise<string> {
    const last = messages.at(-1)?.content ?? '';
    return `[Modo Demo] Recibí tu mensaje: "${last.substring(0, 120)}". Configura GEMINI_API_KEY, OPENAI_API_KEY o ANTHROPIC_API_KEY en Coolify para respuestas reales.`;
  }

  async generateScript(prompt: string, options?: ScriptOptions): Promise<string> {
    const theme = options?.theme ?? 'Reflexión Cristiana';
    return `# ${prompt}\n\n## Introducción\nBienvenidos a una nueva reflexión sobre ${theme}.\n\n## Desarrollo\n${prompt} es un tema que nos invita a profundizar en la Palabra y aplicarla a nuestra vida diaria.\n\n## Conclusión\nQue esta enseñanza inspire tu caminar con Dios.\n\n---\n*Generado en modo demo. Configura un proveedor de IA para contenido personalizado.*`;
  }

  async rewrite(script: string, instruction: string): Promise<string> {
    return `${script}\n\n[Reescrito — ${instruction}]`;
  }

  async generateImage(_prompt: string, _options?: ImageOptions): Promise<string> {
    return DEMO_IMAGE;
  }

  async textToSpeech(_text: string, _voice: string): Promise<TTSResult> {
    return { isDemo: true };
  }

  async optimizeSEO(title: string, _script: string): Promise<SEOResult> {
    return {
      titles: [
        `${title} | Reflexión Cristiana`,
        `¿Qué dice la Biblia sobre ${title}?`,
        `${title} — Mensaje de Fe`,
      ],
      description: `En este video exploramos ${title}: una reflexión cristiana basada en la Palabra de Dios. Suscríbete para más contenido de fe, esperanza y enseñanza bíblica.`,
      tags: ['reflexion', 'cristiana', 'biblia', 'fe', title.toLowerCase().split(' ')[0] ?? 'video'],
      chapters: [
        { time: '00:00', title: 'Introducción' },
        { time: '01:30', title: 'Desarrollo' },
        { time: '04:00', title: 'Aplicación práctica' },
      ],
      hashtags: ['#ReflexionCristiana', '#Biblia', '#Fe'],
      pinnedComment:
        '¿Qué versículo de este mensaje te impactó más? Compártelo abajo — leemos cada comentario 🙏',
    };
  }
}
