import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';
import {
  buildGoogleAuthorizeUrl,
  exchangeGoogleCode,
  getGoogleOAuthClient,
  googleOAuthRedirectUri,
  persistGoogleTokens,
  resolvePublicBaseUrl,
  type GoogleOAuthPurpose,
} from './google.js';
import { signOAuthState, verifyOAuthState } from './state.js';

function isGoogleOAuthPurpose(value: string): value is GoogleOAuthPurpose {
  return value === 'gemini' || value === 'youtube';
}

function settingsReturnUrl(publicBaseUrl: string, params: Record<string, string>): string {
  const query = new URLSearchParams(params);
  return `${publicBaseUrl}/?view=settings&${query.toString()}`;
}

export function registerOAuthRoutes(app: FastifyInstance, prefix: '' | '/api'): void {
  const base = prefix === '/api' ? '/api/oauth' : '/oauth';

  app.get(`${base}/google/start`, async (request, reply) => {
    const query = request.query as { purpose?: string; returnUrl?: string };
    const purpose = query.purpose ?? 'gemini';
    if (!isGoogleOAuthPurpose(purpose)) {
      reply.code(400);
      return { error: 'invalid_purpose' };
    }

    const client = await getGoogleOAuthClient();
    if (!client) {
      reply.code(400);
      return {
        error: 'oauth_client_not_configured',
        message:
          'Configura Google OAuth Client ID y Client Secret en Configuración (o YOUTUBE_CLIENT_ID en el servidor) antes de conectar.',
      };
    }

    const publicBaseUrl = resolvePublicBaseUrl(request.protocol, request.hostname);
    const redirectUri = googleOAuthRedirectUri(publicBaseUrl);
    const returnUrl = query.returnUrl?.trim() || settingsReturnUrl(publicBaseUrl, { oauth: purpose });

    try {
      const state = await signOAuthState({ purpose, returnUrl });
      const authorizeUrl = buildGoogleAuthorizeUrl({
        clientId: client.clientId,
        redirectUri,
        state,
        purpose,
      });
      return { authorizeUrl, redirectUri };
    } catch (err) {
      reply.code(503);
      return {
        error: 'oauth_state_unavailable',
        message: err instanceof Error ? err.message : 'OAuth no disponible',
      };
    }
  });

  app.get(`${base}/google/callback`, async (request: FastifyRequest, reply: FastifyReply) => {
    const query = request.query as { code?: string; state?: string; error?: string };
    const publicBaseUrl = resolvePublicBaseUrl(request.protocol, request.hostname);

    if (query.error) {
      return reply.redirect(
        settingsReturnUrl(publicBaseUrl, {
          oauth: 'gemini',
          oauth_status: 'error',
          oauth_message: query.error,
        }),
      );
    }

    if (!query.code || !query.state) {
      return reply.redirect(
        settingsReturnUrl(publicBaseUrl, {
          oauth: 'gemini',
          oauth_status: 'error',
          oauth_message: 'missing_code',
        }),
      );
    }

    let purpose: GoogleOAuthPurpose;
    let returnUrl: string;
    try {
      const verified = await verifyOAuthState(query.state);
      purpose = verified.purpose;
      returnUrl = verified.returnUrl;
    } catch {
      return reply.redirect(
        settingsReturnUrl(publicBaseUrl, {
          oauth: 'gemini',
          oauth_status: 'error',
          oauth_message: 'invalid_state',
        }),
      );
    }

    const client = await getGoogleOAuthClient();
    if (!client) {
      return reply.redirect(
        settingsReturnUrl(publicBaseUrl, {
          oauth: purpose,
          oauth_status: 'error',
          oauth_message: 'client_not_configured',
        }),
      );
    }

    try {
      const tokens = await exchangeGoogleCode({
        code: query.code,
        clientId: client.clientId,
        clientSecret: client.clientSecret,
        redirectUri: googleOAuthRedirectUri(publicBaseUrl),
      });
      await persistGoogleTokens(tokens, purpose);

      const successUrl = new URL(returnUrl, publicBaseUrl);
      successUrl.searchParams.set('oauth', purpose);
      successUrl.searchParams.set('oauth_status', 'success');
      return reply.redirect(successUrl.toString());
    } catch (err) {
      const message = err instanceof Error ? err.message : 'token_exchange_failed';
      return reply.redirect(
        settingsReturnUrl(publicBaseUrl, {
          oauth: purpose,
          oauth_status: 'error',
          oauth_message: message,
        }),
      );
    }
  });
}
