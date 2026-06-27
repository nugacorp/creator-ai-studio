import type { FastifyInstance } from 'fastify';
import type { SecretProvider, SecretsPatch } from '@creator-ai-studio/shared';
import {
  isGoogleOAuthClientConfigured,
  isSecretsEncryptionAvailable,
  listSecretStatuses,
  patchSecrets,
} from './store.js';
import { invalidateSecretCache } from './resolver.js';
import { testSecretProvider } from './test-connection.js';

const PROVIDERS: SecretProvider[] = [
  'gemini',
  'openai',
  'anthropic',
  'elevenlabs',
  'youtube',
  'webhook',
];

function isSecretProvider(value: string): value is SecretProvider {
  return (PROVIDERS as readonly string[]).includes(value);
}

export function registerSecretRoutes(app: FastifyInstance, prefix: '' | '/api'): void {
  const base = prefix === '/api' ? '/api/secrets' : '/secrets';

  app.get(base, async () => {
    const items = await listSecretStatuses();
    return {
      encryptionAvailable: isSecretsEncryptionAvailable(),
      googleOAuthClientConfigured: await isGoogleOAuthClientConfigured(),
      items,
    };
  });

  app.patch(base, async (request, reply) => {
    if (!isSecretsEncryptionAvailable()) {
      reply.code(503);
      return {
        error: 'secrets_encryption_unavailable',
        message: 'Configure CAS_SECRETS_KEY on the server to store API keys from the UI',
      };
    }

    const body = (request.body ?? {}) as SecretsPatch;
    invalidateSecretCache();
    const items = await patchSecrets(body);
    return { items };
  });

  app.post(`${base}/test/:provider`, async (request, reply) => {
    const { provider } = request.params as { provider: string };
    if (!isSecretProvider(provider)) {
      reply.code(400);
      return { error: 'invalid provider' };
    }
    return testSecretProvider(provider);
  });
}
