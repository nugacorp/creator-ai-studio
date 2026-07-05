import type { FastifyInstance, FastifyReply } from 'fastify';
import {
  getAIUsageLogs,
  getProvidersStatus,
  testProviderOperation,
  withProvider,
} from './router.js';
import type { AIProviderName, ScriptOptions } from './types.js';
import { AIOperationFailedError, ProviderError } from './provider-error.js';
import { aiBody } from '../http/schemas.js';

function sendAIError(reply: FastifyReply, error: unknown): void {
  if (error instanceof AIOperationFailedError) {
    reply.code(error.httpStatus).send(error.toJSON());
    return;
  }
  if (error instanceof ProviderError) {
    const status =
      error.statusCode === 429
        ? 429
        : error.statusCode === 401 || error.statusCode === 403
          ? error.statusCode
          : 502;
    reply.code(status).send({
      error: 'AI_PROVIDER_FAILED',
      message: error.providerMessage,
      operation: error.operation,
      provider: error.provider,
      statusCode: error.statusCode,
      providerErrorCode: error.providerErrorCode,
      attempts: [error.toAttemptSummary()],
    });
    return;
  }
  throw error;
}

async function runAI<T>(reply: FastifyReply, fn: () => Promise<T>): Promise<T | void> {
  try {
    return await fn();
  } catch (error) {
    sendAIError(reply, error);
  }
}

const CHAT_SCOPE_REFUSAL =
  'Soy el copiloto de Creator AI Studio y no puedo responder consultas fuera del proyecto. Puedo ayudarte con episodios, guiones bíblicos, miniaturas, SEO, YouTube, producción, automatización, agentes, integraciones o el estado operativo de Creator AI Studio.';

const CHAT_SCOPE_KEYWORDS = [
  'creator ai studio',
  'creator os',
  'creator',
  'cas',
  'copiloto',
  'proyecto',
  'episodio',
  'guion',
  'guión',
  'biblia',
  'bíblico',
  'biblico',
  'cristiano',
  'youtube',
  'short',
  'titulo',
  'título',
  'ctr',
  'seo',
  'miniatura',
  'thumbnail',
  'produccion',
  'producción',
  'video',
  'canal',
  'metricas',
  'métricas',
  'pipeline',
  'tts',
  'narracion',
  'narración',
  'voz',
  'render',
  'publicacion',
  'publicación',
  'publicar',
  'staging',
  'deploy',
  'despliegue',
  'sistema',
  'worker',
  'redis',
  'supabase',
  'google',
  'gemini',
  'openai',
  'claude',
  'api',
  'dashboard',
  'agente',
  'automatizacion',
  'automatización',
  'contenido',
  'gancho',
  'retencion',
  'retención',
  'audiencia',
];

function normalizeForScope(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function isProjectScopedChat(messages: Array<{ role: string; content: string }>): boolean {
  const lastUserMessage = [...messages]
    .reverse()
    .find(message => message.role === 'user')
    ?.content.trim();

  if (!lastUserMessage) return false;

  const normalized = normalizeForScope(lastUserMessage);
  return CHAT_SCOPE_KEYWORDS.some(keyword => normalized.includes(normalizeForScope(keyword)));
}

function registerAIRoutes(app: FastifyInstance, prefix: '' | '/api'): void {
  const base = prefix === '/api' ? '/api/ai' : '/ai';
  const geminiBase = prefix === '/api' ? '/api/gemini' : '/gemini';

  const handlers = {
    chat: async (
      body: { message?: string; messages?: Array<{ role: string; content: string }>; provider?: string },
      reply: FastifyReply,
    ) => {
      const messages = body.messages ?? [{ role: 'user' as const, content: body.message ?? '' }];
      if (!isProjectScopedChat(messages)) {
        return { reply: CHAT_SCOPE_REFUSAL };
      }

      const result = await runAI(reply, () =>
        withProvider(
          'chat',
          p =>
            p.chat(messages.map(m => ({ role: m.role as 'user' | 'assistant', content: m.content }))),
          { requestProvider: body.provider },
        ),
      );
      if (result === undefined) return;
      return { reply: result };
    },
    generateScript: async (
      body: { prompt?: string; options?: ScriptOptions; provider?: string },
      reply: FastifyReply,
    ) => {
      const result = await runAI(reply, () =>
        withProvider('script', p => p.generateScript(body.prompt ?? '', body.options), {
          requestProvider: body.provider,
        }),
      );
      if (result === undefined) return;
      return { text: result };
    },
    rewrite: async (
      body: { script?: string; instruction?: string; provider?: string },
      reply: FastifyReply,
    ) => {
      const result = await runAI(reply, () =>
        withProvider('rewrite', p => p.rewrite(body.script ?? '', body.instruction ?? ''), {
          requestProvider: body.provider,
        }),
      );
      if (result === undefined) return;
      return { text: result };
    },
    generateImage: async (
      body: {
        prompt?: string;
        aspectRatio?: string;
        imageSize?: string;
        style?: string;
        provider?: string;
      },
      reply: FastifyReply,
    ) => {
      const result = await runAI(reply, () =>
        withProvider(
          'image',
          p =>
            p.generateImage(body.prompt ?? '', {
              aspectRatio: body.aspectRatio,
              imageSize: body.imageSize,
              style: body.style,
            }),
          { requestProvider: body.provider },
        ),
      );
      if (result === undefined) return;
      return { imageUrl: result };
    },
    tts: async (
      body: { text?: string; voice?: string; provider?: string },
      reply: FastifyReply,
    ) => {
      const result = await runAI(reply, () =>
        withProvider('tts', p => p.textToSpeech(body.text ?? '', body.voice ?? 'narrativa'), {
          requestProvider: body.provider,
        }),
      );
      if (result === undefined) return;
      return result;
    },
    seo: async (
      body: { title?: string; script?: string; provider?: string },
      reply: FastifyReply,
    ) => {
      const result = await runAI(reply, () =>
        withProvider('seo', p => p.optimizeSEO(body.title ?? '', body.script ?? ''), {
          requestProvider: body.provider,
        }),
      );
      if (result === undefined) return;
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
    app.post(`${geminiBase}${geminiPath}`, { schema: { body: aiBody } }, async (request, reply) => {
      return handler(request.body as Parameters<typeof handler>[0], reply);
    });
    app.post(`${base}${canonicalPath}`, { schema: { body: aiBody } }, async (request, reply) => {
      return handler(request.body as Parameters<typeof handler>[0], reply);
    });
  }

  app.get(`${base}/usage`, async () => ({ logs: getAIUsageLogs() }));

  app.get(`${base}/providers/status`, async () => getProvidersStatus());

  app.post(`${base}/providers/:provider/test`, async (request, reply) => {
    const { provider } = request.params as { provider: string };
    const body = (request.body ?? {}) as { operation?: string; prompt?: string };
    const operation = body.operation ?? 'script';
    const prompt = body.prompt ?? 'Responde exactamente: CAS_TEST_OK';

    const normalized = provider === 'anthropic' ? 'claude' : provider;
    if (!['gemini', 'openai', 'claude'].includes(normalized)) {
      reply.code(400);
      return { error: 'INVALID_PROVIDER', message: `Unknown provider: ${provider}` };
    }

    const result = await testProviderOperation(
      normalized as AIProviderName,
      operation,
      prompt,
    );

    if (result.ok) {
      return {
        ok: true,
        provider: result.provider,
        operation,
        text: result.text,
      };
    }

    const err = result.error;
    const status =
      err.statusCode === 429 ? 429 : err.statusCode === 401 || err.statusCode === 403 ? err.statusCode : 502;
    reply.code(status);
    return {
      ok: false,
      provider: err.provider,
      operation: err.operation,
      statusCode: err.statusCode,
      providerErrorCode: err.providerErrorCode,
      providerMessage: err.providerMessage,
      retryable: err.retryable,
      timestamp: err.timestamp,
    };
  });
}

export { registerAIRoutes };
