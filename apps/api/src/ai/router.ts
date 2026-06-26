import process from 'node:process';
import { ClaudeAIProvider } from './claude.js';
import { DemoAIProvider } from './demo.js';
import { GeminiAIProvider } from './gemini.js';
import { OpenAIProvider } from './openai.js';
import type { AIProvider, AIProviderName, AIUsageLog } from './types.js';

const usageLogs: AIUsageLog[] = [];

function createProvider(name: AIProviderName): AIProvider {
  switch (name) {
    case 'gemini': {
      const key = process.env.GEMINI_API_KEY;
      return key ? new GeminiAIProvider(key) : new DemoAIProvider();
    }
    case 'openai': {
      const key = process.env.OPENAI_API_KEY;
      return key ? new OpenAIProvider(key) : new DemoAIProvider();
    }
    case 'claude': {
      const key = process.env.ANTHROPIC_API_KEY;
      return key ? new ClaudeAIProvider(key) : new DemoAIProvider();
    }
    default:
      return new DemoAIProvider();
  }
}

function resolveProvider(operation?: string): AIProvider {
  const envKey = operation
    ? `AI_${operation.toUpperCase()}_PROVIDER`
    : undefined;
  const override = envKey ? process.env[envKey] : undefined;
  const name = (override ?? process.env.AI_PROVIDER_DEFAULT ?? 'gemini') as AIProviderName;
  return createProvider(name);
}

export async function withProvider<T>(
  operation: string,
  fn: (provider: AIProvider) => Promise<T>,
): Promise<T> {
  const provider = resolveProvider(operation);
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
