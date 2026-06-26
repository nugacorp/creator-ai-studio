import process from 'node:process';
import { ClaudeAIProvider } from './claude.js';
import { DemoAIProvider } from './demo.js';
import { GeminiAIProvider } from './gemini.js';
import { OpenAIProvider } from './openai.js';
import type { AIProvider, AIProviderName, AIUsageLog } from './types.js';
import { getGeminiAuth } from '../secrets/google-auth.js';
import { getSecret } from '../secrets/resolver.js';

const usageLogs: AIUsageLog[] = [];

async function createProvider(name: AIProviderName): Promise<AIProvider> {
  switch (name) {
    case 'gemini': {
      const auth = await getGeminiAuth();
      return auth ? new GeminiAIProvider(auth) : new DemoAIProvider();
    }
    case 'openai': {
      const key = await getSecret('OPENAI_API_KEY');
      return key ? new OpenAIProvider(key) : new DemoAIProvider();
    }
    case 'claude': {
      const key = await getSecret('ANTHROPIC_API_KEY');
      return key ? new ClaudeAIProvider(key) : new DemoAIProvider();
    }
    default:
      return new DemoAIProvider();
  }
}

async function resolveProvider(operation?: string): Promise<AIProvider> {
  const envKey = operation ? `AI_${operation.toUpperCase()}_PROVIDER` : undefined;
  const override = envKey ? process.env[envKey] : undefined;
  const name = (override ?? process.env.AI_PROVIDER_DEFAULT ?? 'gemini') as AIProviderName;
  return createProvider(name);
}

export async function withProvider<T>(
  operation: string,
  fn: (provider: AIProvider) => Promise<T>,
): Promise<T> {
  const provider = await resolveProvider(operation);
  const start = Date.now();
  try {
    return await fn(provider);
  } finally {
    usageLogs.push({
      provider: provider.name,
      operation,
      latencyMs: Date.now() - start,
      timestamp: new Date().toISOString(),
    });
    if (usageLogs.length > 1000) {
      usageLogs.splice(0, usageLogs.length - 500);
    }
  }
}

export function getAIUsageLogs(): AIUsageLog[] {
  return [...usageLogs];
}

export { createProvider, resolveProvider };
