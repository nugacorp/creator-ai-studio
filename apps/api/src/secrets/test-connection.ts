import type { SecretProvider, SecretTestResult } from '@creator-ai-studio/shared';
import { getGeminiAuth, getValidGoogleAccessToken, googleOAuthHeaders, formatGoogleApiTestError, hasYoutubeOAuthScope } from './google-auth.js';
import { getSecret, getSecretByField } from './resolver.js';

export async function testSecretProvider(provider: SecretProvider): Promise<SecretTestResult> {
  try {
    switch (provider) {
      case 'gemini': {
        const auth = await getGeminiAuth();
        if (!auth) {
          return { provider, ok: false, message: 'Gemini no configurado (OAuth o API key)' };
        }
        const headers: Record<string, string> = {};
        const url =
          auth.mode === 'api_key'
            ? `https://generativelanguage.googleapis.com/v1beta/models?key=${encodeURIComponent(auth.value)}`
            : 'https://generativelanguage.googleapis.com/v1/models';
        if (auth.mode === 'oauth') {
          Object.assign(headers, await googleOAuthHeaders(auth.accessToken));
        }
        const res = await fetch(url, { headers });
        const body = await res.text().catch(() => '');
        return {
          provider,
          ok: res.ok,
          message: res.ok
            ? `Conexión con Gemini OK (${auth.mode === 'oauth' ? 'OAuth' : 'API key'})`
            : formatGoogleApiTestError('Gemini', res.status, body),
        };
      }
      case 'openai': {
        const key = await getSecretByField('openaiApiKey');
        if (!key) return { provider, ok: false, message: 'OPENAI_API_KEY no configurada' };
        const res = await fetch('https://api.openai.com/v1/models', {
          headers: { Authorization: `Bearer ${key}` },
        });
        return {
          provider,
          ok: res.ok,
          message: res.ok ? 'Conexión con OpenAI OK' : `OpenAI respondió ${res.status}`,
        };
      }
      case 'anthropic': {
        const key = await getSecretByField('anthropicApiKey');
        if (!key) return { provider, ok: false, message: 'ANTHROPIC_API_KEY no configurada' };
        const res = await fetch('https://api.anthropic.com/v1/messages', {
          method: 'POST',
          headers: {
            'x-api-key': key,
            'anthropic-version': '2023-06-01',
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            model: 'claude-sonnet-4-20250514',
            max_tokens: 1,
            messages: [{ role: 'user', content: 'ping' }],
          }),
        });
        return {
          provider,
          ok: res.status === 200 || res.status === 400,
          message: res.ok || res.status === 400 ? 'Conexión con Claude OK' : `Anthropic respondió ${res.status}`,
        };
      }
      case 'elevenlabs': {
        const key = await getSecretByField('elevenlabsApiKey');
        if (!key) return { provider, ok: false, message: 'ELEVENLABS_API_KEY no configurada' };
        const res = await fetch('https://api.elevenlabs.io/v1/user', {
          headers: { 'xi-api-key': key },
        });
        return {
          provider,
          ok: res.ok,
          message: res.ok ? 'Conexión con ElevenLabs OK' : `ElevenLabs respondió ${res.status}`,
        };
      }
      case 'youtube': {
        const dedicated = await getSecretByField('youtubeAccessToken');
        const token = dedicated ?? (await getValidGoogleAccessToken());
        if (!token) {
          return { provider, ok: false, message: 'YouTube no conectado (OAuth o access token)' };
        }
        if (!dedicated && !(await hasYoutubeOAuthScope())) {
          return {
            provider,
            ok: false,
            message:
              'OAuth sin permisos YouTube. Abre la tarjeta YouTube y pulsa Reconectar (no uses solo Gemini).',
          };
        }
        const res = await fetch(
          'https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true',
          { headers: { Authorization: `Bearer ${token}` } },
        );
        const body = await res.text().catch(() => '');
        return {
          provider,
          ok: res.ok,
          message: res.ok ? 'Token de YouTube válido' : formatGoogleApiTestError('YouTube', res.status, body),
        };
      }
      case 'webhook': {
        const url = await getSecret('WEBHOOK_URL');
        if (!url) return { provider, ok: false, message: 'WEBHOOK_URL no configurada' };
        const res = await fetch(url, { method: 'POST', body: JSON.stringify({ test: true }) });
        return {
          provider,
          ok: res.status < 500,
          message: res.status < 500 ? `Webhook respondió ${res.status}` : `Webhook error ${res.status}`,
        };
      }
      default:
        return { provider, ok: false, message: 'Proveedor desconocido' };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error de red';
    return { provider, ok: false, message };
  }
}
