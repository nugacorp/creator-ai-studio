import type { FastifyInstance } from 'fastify';
import { getAIUsageLogs, withProvider } from './router.js';
import type { ScriptOptions } from './types.js';

function registerAIRoutes(app: FastifyInstance, prefix: '' | '/api'): void {
  const base = prefix === '/api' ? '/api/ai' : '/ai';
  const geminiBase = prefix === '/api' ? '/api/gemini' : '/gemini';

  const handlers = {
    chat: async (body: { message?: string; messages?: Array<{ role: string; content: string }> }) => {
      const messages = body.messages ?? [{ role: 'user' as const, content: body.message ?? '' }];
      const reply = await withProvider('chat', p =>
        p.chat(messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))),
      );
      return { reply };
    },
    generateScript: async (body: { prompt?: string; options?: ScriptOptions }) => {
      const text = await withProvider('script', p =>
        p.generateScript(body.prompt ?? '', body.options),
      );
      return { text };
    },
    rewrite: async (body: { script?: string; instruction?: string }) => {
      const text = await withProvider('rewrite', p =>
        p.rewrite(body.script ?? '', body.instruction ?? ''),
      );
      return { text };
    },
    generateImage: async (body: {
      prompt?: string;
      aspectRatio?: string;
      imageSize?: string;
      style?: string;
    }) => {
      const imageUrl = await withProvider('image', p =>
        p.generateImage(body.prompt ?? '', {
          aspectRatio: body.aspectRatio,
          imageSize: body.imageSize,
          style: body.style,
        }),
      );
      return { imageUrl };
    },
    tts: async (body: { text?: string; voice?: string }) => {
      const result = await withProvider('tts', p =>
        p.textToSpeech(body.text ?? '', body.voice ?? 'narrativa'),
      );
      return result;
    },
    seo: async (body: { title?: string; script?: string }) => {
      const result = await withProvider('seo', p =>
        p.optimizeSEO(body.title ?? '', body.script ?? ''),
      );
      return result;
    },
  };

  for (const [geminiPath, canonicalPath, handler] of [
    ['/chat', '/chat', handlers.chat],
    ['/generate-script', '/generate-script', handlers.generateScript],
    ['/rewrite', '/rewrite', handlers.rewrite],
    ['/generate-image', '/generate-image', handlers.generateImage],
    ['/tts', '/tts', handlers.tts],
    ['/seo', '/seo', handlers.seo],
  ] as const) {
    app.post(`${geminiBase}${geminiPath}`, async (request) => {
      return handler(request.body as Parameters<typeof handler>[0]);
    });
    app.post(`${base}${canonicalPath}`, async (request) => {
      return handler(request.body as Parameters<typeof handler>[0]);
    });
  }

  app.get(`${base}/usage`, async () => ({ logs: getAIUsageLogs() }));
}

export { registerAIRoutes };
