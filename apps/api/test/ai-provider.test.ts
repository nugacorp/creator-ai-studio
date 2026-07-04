import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { EpisodeStorage } from '../src/storage/index.js';
import {
  ProviderError,
  AIOperationFailedError,
  providerErrorFromResponse,
  sanitizeProviderText,
} from '../src/ai/provider-error.js';
import {
  resetProviderStatusCacheForTests,
} from '../src/ai/router.js';

const originalFetch = globalThis.fetch;

function mockFetch(handler: (url: string, init?: RequestInit) => Response | Promise<Response>): void {
  globalThis.fetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
    const url = typeof input === 'string' ? input : input instanceof URL ? input.href : input.url;
    return handler(url, init);
  }) as typeof fetch;
}

describe('AI provider errors and fallback', () => {
  let storageDir: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    storageDir = await mkdtemp(path.join(tmpdir(), 'cas-ai-'));
    process.env.OPENAI_API_KEY = 'sk-test-openai-key-1234567890';
    process.env.ANTHROPIC_API_KEY = 'sk-ant-test-key-1234567890';
    process.env.GEMINI_API_KEY = 'AIzaSyTestKey1234567890abcdefghij';
    process.env.AI_FALLBACK_ENABLED = 'true';
    process.env.AI_FALLBACK_ORDER = 'gemini,openai,claude';
    process.env.AI_ALLOW_DEMO_FALLBACK = 'false';
    delete process.env.AI_SCRIPT_PROVIDER;
    delete process.env.AI_PROVIDER_DEFAULT;
    resetProviderStatusCacheForTests();
    app = buildApp({ storage: new EpisodeStorage(storageDir) });
    await app.ready();
  });

  afterEach(async () => {
    globalThis.fetch = originalFetch;
    vi.restoreAllMocks();
    await app.close();
    await rm(storageDir, { recursive: true, force: true });
    delete process.env.OPENAI_API_KEY;
    delete process.env.ANTHROPIC_API_KEY;
    delete process.env.GEMINI_API_KEY;
    delete process.env.AI_FALLBACK_ENABLED;
    delete process.env.AI_FALLBACK_ORDER;
    delete process.env.AI_ALLOW_DEMO_FALLBACK;
  });

  it('sanitizeProviderText redacts API keys and bearer tokens', () => {
    const text =
      'Bearer sk-proj-abcdefghijklmnopqrstuvwxyz and AIzaSyRealKey1234567890abcdef';
    const sanitized = sanitizeProviderText(text);
    expect(sanitized).not.toContain('sk-proj');
    expect(sanitized).not.toContain('AIzaSyRealKey');
    expect(sanitized).toContain('[REDACTED]');
  });

  it('Gemini 403 produces sanitized ProviderError', async () => {
    process.env.AI_FALLBACK_ENABLED = 'false';
    mockFetch(url => {
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(
          JSON.stringify({
            error: { code: 403, message: 'API key not valid', status: 'PERMISSION_DENIED' },
          }),
          { status: 403 },
        );
      }
      return new Response('not found', { status: 404 });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/ai/generate-script',
      payload: { prompt: 'test', provider: 'gemini' },
    });

    expect(response.statusCode).toBe(403);
    const body = response.json() as { error: string; attempts?: Array<{ provider: string; statusCode: number }> };
    expect(body.error).toBe('AI_PROVIDER_FAILED');
    const attempts = body.attempts ?? [];
    expect(attempts.some(a => a.provider === 'gemini' && a.statusCode === 403) || body.attempts === undefined).toBe(true);
    expect(JSON.stringify(body)).not.toContain('AIzaSy');
  });

  it('OpenAI 429 produces sanitized ProviderError', async () => {
    mockFetch(url => {
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(JSON.stringify({ error: { message: 'denied' } }), { status: 403 });
      }
      if (url.includes('api.openai.com')) {
        return new Response(
          JSON.stringify({
            error: { message: 'Rate limit exceeded', type: 'rate_limit_error', code: 'rate_limit_exceeded' },
          }),
          { status: 429 },
        );
      }
      if (url.includes('anthropic.com')) {
        return new Response(JSON.stringify({ error: { message: 'bad' } }), { status: 400 });
      }
      return new Response('not found', { status: 404 });
    });

    process.env.AI_SCRIPT_PROVIDER = 'openai';

    const response = await app.inject({
      method: 'POST',
      url: '/api/ai/generate-script',
      payload: { prompt: 'test' },
    });

    expect([429, 403, 502]).toContain(response.statusCode);
    const body = response.json() as { attempts?: Array<{ provider: string; statusCode: number }> };
    const attempts = body.attempts ?? [];
    expect(
      attempts.some(a => a.provider === 'openai' && a.statusCode === 429) ||
        attempts.some(a => a.statusCode === 429),
    ).toBe(true);
    expect(JSON.stringify(body)).not.toContain('sk-test-openai');
  });

  it('Claude 400 produces sanitized ProviderError', async () => {
    mockFetch(url => {
      if (url.includes('anthropic.com')) {
        return new Response(
          JSON.stringify({
            type: 'error',
            error: { type: 'invalid_request_error', message: 'model not found' },
          }),
          { status: 400 },
        );
      }
      return new Response(JSON.stringify({ content: [{ type: 'text', text: 'ok' }] }), { status: 200 });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/ai/providers/claude/test',
      payload: { operation: 'script', prompt: 'CAS_TEST_OK' },
    });

    expect(response.statusCode).toBe(502);
    const body = response.json() as { ok: boolean; statusCode: number; providerMessage: string };
    expect(body.ok).toBe(false);
    expect(body.statusCode).toBe(400);
    expect(body.providerMessage).toContain('model');
    expect(JSON.stringify(body)).not.toContain('sk-ant-test');
  });

  it('fallback tries OpenAI when Gemini fails', async () => {
    mockFetch(url => {
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(JSON.stringify({ error: { message: 'forbidden' } }), { status: 403 });
      }
      if (url.includes('api.openai.com')) {
        return new Response(
          JSON.stringify({ choices: [{ message: { content: 'CAS_OPENAI_OK' } }] }),
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/ai/generate-script',
      payload: { prompt: 'hola' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json() as { text: string };
    expect(body.text).toBe('CAS_OPENAI_OK');
  });

  it('fallback tries Claude when Gemini and OpenAI fail', async () => {
    mockFetch(url => {
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(JSON.stringify({ error: { message: 'forbidden' } }), { status: 403 });
      }
      if (url.includes('api.openai.com')) {
        return new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 429 });
      }
      if (url.includes('anthropic.com')) {
        return new Response(
          JSON.stringify({ content: [{ type: 'text', text: 'CAS_CLAUDE_OK' }] }),
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/ai/generate-script',
      payload: { prompt: 'hola' },
    });

    expect(response.statusCode).toBe(200);
    expect((response.json() as { text: string }).text).toBe('CAS_CLAUDE_OK');
  });

  it('returns aggregated error when all providers fail', async () => {
    mockFetch(url => {
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(JSON.stringify({ error: { message: 'forbidden' } }), { status: 403 });
      }
      if (url.includes('api.openai.com')) {
        return new Response(JSON.stringify({ error: { message: 'quota' } }), { status: 429 });
      }
      if (url.includes('anthropic.com')) {
        return new Response(JSON.stringify({ error: { message: 'bad request' } }), { status: 400 });
      }
      return new Response('not found', { status: 404 });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/ai/generate-script',
      payload: { prompt: 'hola' },
    });

    expect(response.statusCode).toBe(403);
    const body = response.json() as { error: string; attempts: unknown[] };
    expect(body.error).toBe('AI_PROVIDER_FAILED');
    expect(body.attempts.length).toBeGreaterThanOrEqual(3);
  });

  it('GET /api/ai/providers/status does not expose secrets', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/ai/providers/status' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { providers: unknown[]; defaultProvider: string };
    expect(body.defaultProvider).toBeTruthy();
    expect(body.providers.length).toBe(3);
    const raw = JSON.stringify(body);
    expect(raw).not.toContain('sk-test');
    expect(raw).not.toContain('AIzaSy');
  });

  it('POST /api/ai/providers/:provider/test uses only requested provider', async () => {
    let openaiCalled = false;
    mockFetch(url => {
      if (url.includes('api.openai.com')) {
        openaiCalled = true;
        return new Response(
          JSON.stringify({ choices: [{ message: { content: 'CAS_TEST_OK' } }] }),
          { status: 200 },
        );
      }
      return new Response(JSON.stringify({ error: { message: 'no' } }), { status: 403 });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/ai/providers/openai/test',
      payload: { operation: 'script', prompt: 'Responde exactamente: CAS_TEST_OK' },
    });

    expect(response.statusCode).toBe(200);
    expect((response.json() as { ok: boolean; text: string }).text).toBe('CAS_TEST_OK');
    expect(openaiCalled).toBe(true);
  });

  it('generate-script works when alternate provider succeeds via fallback', async () => {
    process.env.AI_SCRIPT_PROVIDER = 'gemini';
    mockFetch(url => {
      if (url.includes('generativelanguage.googleapis.com')) {
        return new Response(JSON.stringify({ error: { message: 'denied' } }), { status: 403 });
      }
      if (url.includes('api.openai.com')) {
        return new Response(
          JSON.stringify({ choices: [{ message: { content: 'Script from OpenAI' } }] }),
          { status: 200 },
        );
      }
      return new Response('not found', { status: 404 });
    });

    const response = await app.inject({
      method: 'POST',
      url: '/api/ai/generate-script',
      payload: { prompt: 'Tema: fe' },
    });

    expect(response.statusCode).toBe(200);
    expect((response.json() as { text: string }).text).toBe('Script from OpenAI');
  });
});

describe('providerErrorFromResponse unit', () => {
  it('maps OpenAI error body fields', async () => {
    const response = new Response(
      JSON.stringify({
        error: { message: 'Insufficient quota', code: 'insufficient_quota' },
      }),
      { status: 429 },
    );
    const err = await providerErrorFromResponse('openai', 'script', response);
    expect(err).toBeInstanceOf(ProviderError);
    expect(err.statusCode).toBe(429);
    expect(err.providerErrorCode).toBe('insufficient_quota');
    expect(err.providerMessage).toContain('quota');
  });

  it('AIOperationFailedError uses 429 when all attempts are rate limited', () => {
    const attempts = [
      new ProviderError({ provider: 'gemini', operation: 'script', statusCode: 429, providerMessage: 'rate' }),
      new ProviderError({ provider: 'openai', operation: 'script', statusCode: 429, providerMessage: 'rate' }),
    ];
    const err = new AIOperationFailedError('script', attempts);
    expect(err.httpStatus).toBe(429);
  });
});
