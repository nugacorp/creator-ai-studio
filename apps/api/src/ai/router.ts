import process from 'node:process';
import { ClaudeAIProvider } from './claude.js';
import { DemoAIProvider } from './demo.js';
import { GeminiAIProvider } from './gemini.js';
import { OpenAIProvider } from './openai.js';
import type { AIProvider, AIProviderName, AIUsageLog } from './types.js';
import { getGeminiAuth } from '../secrets/google-auth.js';
import { getSecret } from '../secrets/resolver.js';
import { getSettings } from '../settings/store.js';
import { areMocksAllowed } from '../config/mocks.js';
import {
  AIOperationFailedError,
  ProviderError,
  shouldFallbackOnError,
} from './provider-error.js';

const usageLogs: AIUsageLog[] = [];

export interface ProviderStatusSnapshot {
  provider: AIProviderName;
  configured: boolean;
  authMethod: 'oauth' | 'api_key' | 'none';
  lastStatus?: number;
  lastError?: string;
  lastCheckedAt?: string;
}

const providerStatusCache = new Map<AIProviderName, ProviderStatusSnapshot>();

const REAL_PROVIDERS: AIProviderName[] = ['gemini', 'openai', 'claude'];

function isAllowedProviderName(name: string): name is AIProviderName {
  return REAL_PROVIDERS.includes(name as AIProviderName) || name === 'demo';
}

function isFallbackEnabled(): boolean {
  const flag = process.env.AI_FALLBACK_ENABLED;
  return flag === undefined || flag === 'true' || flag === '1';
}

function isDemoFallbackAllowed(): boolean {
  // FASE 8: demo AI is a mock — never allowed when mocks are blocked
  // (production by default), regardless of AI_ALLOW_DEMO_FALLBACK.
  if (!areMocksAllowed()) return false;
  return process.env.AI_ALLOW_DEMO_FALLBACK === 'true' || process.env.AI_ALLOW_DEMO_FALLBACK === '1';
}

function getFallbackOrder(): AIProviderName[] {
  const raw = process.env.AI_FALLBACK_ORDER ?? 'gemini,openai,claude';
  return raw
    .split(',')
    .map(s => s.trim().toLowerCase())
    .filter((name): name is AIProviderName => REAL_PROVIDERS.includes(name as AIProviderName));
}

export async function isProviderConfigured(name: AIProviderName): Promise<boolean> {
  switch (name) {
    case 'gemini':
      return Boolean(await getGeminiAuth());
    case 'openai':
      return Boolean(await getSecret('OPENAI_API_KEY'));
    case 'claude':
      return Boolean(await getSecret('ANTHROPIC_API_KEY'));
    case 'demo':
      return true;
    default:
      return false;
  }
}

async function getProviderAuthMethod(name: AIProviderName): Promise<'oauth' | 'api_key' | 'none'> {
  if (name === 'gemini') {
    const auth = await getGeminiAuth();
    if (!auth) return 'none';
    return auth.mode === 'oauth' ? 'oauth' : 'api_key';
  }
  if (name === 'openai' || name === 'claude') {
    return (await isProviderConfigured(name)) ? 'api_key' : 'none';
  }
  return 'none';
}

function recordProviderStatus(error: ProviderError): void {
  providerStatusCache.set(error.provider, {
    provider: error.provider,
    configured: true,
    authMethod: providerStatusCache.get(error.provider)?.authMethod ?? 'api_key',
    lastStatus: error.statusCode,
    lastError: error.providerMessage,
    lastCheckedAt: error.timestamp,
  });
}

function recordProviderSuccess(name: AIProviderName): void {
  const prev = providerStatusCache.get(name);
  providerStatusCache.set(name, {
    provider: name,
    configured: true,
    authMethod: prev?.authMethod ?? 'api_key',
    lastStatus: 200,
    lastError: undefined,
    lastCheckedAt: new Date().toISOString(),
  });
}

export async function createProvider(
  name: AIProviderName,
  options?: { allowDemo?: boolean },
): Promise<AIProvider> {
  const allowDemo = options?.allowDemo ?? isDemoFallbackAllowed();

  switch (name) {
    case 'gemini': {
      const auth = await getGeminiAuth();
      if (auth) return new GeminiAIProvider(auth);
      break;
    }
    case 'openai': {
      const key = await getSecret('OPENAI_API_KEY');
      if (key) return new OpenAIProvider(key);
      break;
    }
    case 'claude': {
      const key = await getSecret('ANTHROPIC_API_KEY');
      if (key) return new ClaudeAIProvider(key);
      break;
    }
    case 'demo':
      if (!areMocksAllowed()) {
        throw new ProviderError({
          provider: 'demo',
          operation: 'configure',
          statusCode: 403,
          providerMessage: 'Demo provider blocked: mocks are not allowed in this environment.',
          retryable: false,
        });
      }
      return new DemoAIProvider();
    default:
      break;
  }

  if (allowDemo && areMocksAllowed()) {
    return new DemoAIProvider();
  }

  throw new ProviderError({
    provider: name,
    operation: 'configure',
    statusCode: 401,
    providerMessage: `${name} is not configured (missing credentials).`,
    retryable: false,
  });
}

export async function resolveProviderName(
  operation: string,
  requestProvider?: string,
): Promise<AIProviderName> {
  if (requestProvider && isAllowedProviderName(requestProvider) && requestProvider !== 'demo') {
    return requestProvider;
  }

  const settings = await getSettings();
  if (settings.aiProviderDefault && isAllowedProviderName(settings.aiProviderDefault)) {
    return settings.aiProviderDefault as AIProviderName;
  }

  const envKey = `AI_${operation.toUpperCase()}_PROVIDER`;
  const opOverride = process.env[envKey];
  if (opOverride && isAllowedProviderName(opOverride)) {
    return opOverride as AIProviderName;
  }

  const defaultEnv = process.env.AI_PROVIDER_DEFAULT;
  if (defaultEnv && isAllowedProviderName(defaultEnv)) {
    return defaultEnv as AIProviderName;
  }

  return 'gemini';
}

function buildProviderAttemptOrder(primary: AIProviderName): AIProviderName[] {
  const order = getFallbackOrder();
  const seen = new Set<AIProviderName>();
  const result: AIProviderName[] = [];

  for (const name of [primary, ...order]) {
    if (!seen.has(name) && REAL_PROVIDERS.includes(name)) {
      seen.add(name);
      result.push(name);
    }
  }
  return result;
}

export interface WithProviderOptions {
  requestProvider?: string;
  /** When set, only this provider is used (no fallback). */
  forceProvider?: AIProviderName;
  allowDemo?: boolean;
}

export async function withProvider<T>(
  operation: string,
  fn: (provider: AIProvider) => Promise<T>,
  options?: WithProviderOptions,
): Promise<T> {
  const primary = options?.forceProvider ?? (await resolveProviderName(operation, options?.requestProvider));
  const attempts: ProviderError[] = [];
  const providersToTry = options?.forceProvider
    ? [options.forceProvider]
    : buildProviderAttemptOrder(primary);

  for (const name of providersToTry) {
    const configured = await isProviderConfigured(name);
    const authMethod = await getProviderAuthMethod(name);

    providerStatusCache.set(name, {
      provider: name,
      configured,
      authMethod,
      lastStatus: providerStatusCache.get(name)?.lastStatus,
      lastError: providerStatusCache.get(name)?.lastError,
      lastCheckedAt: providerStatusCache.get(name)?.lastCheckedAt,
    });

    if (!configured) {
      const err = new ProviderError({
        provider: name,
        operation,
        statusCode: 401,
        providerMessage: `${name} is not configured.`,
        retryable: false,
      });
      attempts.push(err);
      recordProviderStatus(err);
      continue;
    }

    let provider: AIProvider;
    try {
      provider = await createProvider(name, { allowDemo: false });
    } catch (error) {
      if (error instanceof ProviderError) {
        attempts.push(error);
        recordProviderStatus(error);
      }
      continue;
    }

    const start = Date.now();
    let success = false;
    try {
      const result = await fn(provider);
      success = true;
      recordProviderSuccess(name);
      return result;
    } catch (error) {
      if (error instanceof ProviderError) {
        attempts.push(error);
        recordProviderStatus(error);
        if (!isFallbackEnabled() || options?.forceProvider || !shouldFallbackOnError(error.statusCode)) {
          throw error;
        }
        continue;
      }
      throw error;
    } finally {
      usageLogs.push({
        provider: provider.name,
        operation,
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        success,
      });
      if (usageLogs.length > 1000) {
        usageLogs.splice(0, usageLogs.length - 500);
      }
    }
  }

  if (isDemoFallbackAllowed() && !options?.forceProvider) {
    const demo = new DemoAIProvider();
    const start = Date.now();
    try {
      const result = await fn(demo);
      usageLogs.push({
        provider: 'demo',
        operation,
        latencyMs: Date.now() - start,
        timestamp: new Date().toISOString(),
        success: true,
      });
      return result;
    } catch {
      // fall through to aggregated error
    }
  }

  if (attempts.length === 0) {
    throw new ProviderError({
      provider: primary,
      operation,
      statusCode: 502,
      providerMessage: 'No configured AI providers available.',
    });
  }

  throw new AIOperationFailedError(operation, attempts);
}

export async function resolveProvider(operation?: string): Promise<AIProvider> {
  const name = await resolveProviderName(operation ?? 'script');
  return createProvider(name, { allowDemo: isDemoFallbackAllowed() });
}

export function getAIUsageLogs(): AIUsageLog[] {
  return [...usageLogs];
}

export async function getProvidersStatus(): Promise<{
  defaultProvider: string;
  operationProviders: Record<string, string>;
  providers: ProviderStatusSnapshot[];
}> {
  const settings = await getSettings();
  const defaultProvider =
    settings.aiProviderDefault ?? process.env.AI_PROVIDER_DEFAULT ?? 'gemini';

  const operationProviders: Record<string, string> = {};
  for (const op of ['script', 'chat', 'rewrite', 'image', 'tts', 'seo']) {
    operationProviders[op] = await resolveProviderName(op);
  }

  const providers: ProviderStatusSnapshot[] = [];
  for (const name of REAL_PROVIDERS) {
    const configured = await isProviderConfigured(name);
    const authMethod = await getProviderAuthMethod(name);
    const cached = providerStatusCache.get(name);
    providers.push({
      provider: name,
      configured,
      authMethod,
      lastStatus: cached?.lastStatus,
      lastError: cached?.lastError,
      lastCheckedAt: cached?.lastCheckedAt,
    });
  }

  return { defaultProvider, operationProviders, providers };
}

export async function testProviderOperation(
  providerName: AIProviderName,
  operation: string,
  prompt: string,
): Promise<{ ok: true; provider: AIProviderName; text: string } | { ok: false; error: ProviderError }> {
  if (!REAL_PROVIDERS.includes(providerName)) {
    return {
      ok: false,
      error: new ProviderError({
        provider: providerName,
        operation,
        statusCode: 400,
        providerMessage: `Unknown provider: ${providerName}`,
      }),
    };
  }

  try {
    const text = await withProvider(
      operation,
      async provider => {
        if (operation === 'script') {
          return provider.generateScript(prompt);
        }
        if (operation === 'chat') {
          return provider.chat([{ role: 'user', content: prompt }]);
        }
        return provider.generateScript(prompt);
      },
      { forceProvider: providerName },
    );
    return { ok: true, provider: providerName, text };
  } catch (error) {
    if (error instanceof ProviderError) {
      return { ok: false, error };
    }
    if (error instanceof AIOperationFailedError && error.attempts.length > 0) {
      const first = error.attempts[0];
      return {
        ok: false,
        error: new ProviderError({
          provider: first.provider,
          operation,
          statusCode: first.statusCode,
          providerMessage: first.providerMessage,
          providerErrorCode: first.providerErrorCode,
        }),
      };
    }
    return {
      ok: false,
      error: new ProviderError({
        provider: providerName,
        operation,
        statusCode: 502,
        providerMessage: error instanceof Error ? error.message : 'Unknown error',
      }),
    };
  }
}

/** @internal test helper */
export function resetProviderStatusCacheForTests(): void {
  providerStatusCache.clear();
}

export { REAL_PROVIDERS };
