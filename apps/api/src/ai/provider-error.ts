import type { AIProviderName } from './types.js';

const SECRET_PATTERNS: RegExp[] = [
  /Bearer\s+[A-Za-z0-9._~+/=-]+/gi,
  /sk-[A-Za-z0-9]{8,}/g,
  /AIza[A-Za-z0-9_-]{20,}/g,
  /xox[baprs]-[A-Za-z0-9-]+/g,
  /ya29\.[A-Za-z0-9._-]+/g,
  /"api[_-]?key"\s*:\s*"[^"]+"/gi,
  /"access_token"\s*:\s*"[^"]+"/gi,
  /"refresh_token"\s*:\s*"[^"]+"/gi,
  /"authorization"\s*:\s*"[^"]+"/gi,
];

export function sanitizeProviderText(text: string, maxLen = 500): string {
  let result = text;
  for (const pattern of SECRET_PATTERNS) {
    result = result.replace(pattern, '[REDACTED]');
  }
  return result.trim().substring(0, maxLen);
}

export function isRetryableStatus(statusCode: number): boolean {
  return statusCode === 429 || statusCode === 500 || statusCode === 502 || statusCode === 503;
}

export function shouldFallbackOnError(statusCode: number): boolean {
  return [400, 401, 403, 429, 500, 502, 503].includes(statusCode);
}

export interface ProviderErrorInit {
  provider: AIProviderName;
  operation: string;
  statusCode: number;
  providerErrorCode?: string;
  providerMessage: string;
  retryable?: boolean;
  rawBodyRedacted?: string;
}

export class ProviderError extends Error {
  readonly provider: AIProviderName;
  readonly operation: string;
  readonly statusCode: number;
  readonly providerErrorCode?: string;
  readonly providerMessage: string;
  readonly retryable: boolean;
  readonly rawBodyRedacted?: string;
  readonly timestamp: string;

  constructor(init: ProviderErrorInit) {
    super(init.providerMessage);
    this.name = 'ProviderError';
    this.provider = init.provider;
    this.operation = init.operation;
    this.statusCode = init.statusCode;
    this.providerErrorCode = init.providerErrorCode;
    this.providerMessage = sanitizeProviderText(init.providerMessage);
    this.retryable = init.retryable ?? isRetryableStatus(init.statusCode);
    this.rawBodyRedacted = init.rawBodyRedacted
      ? sanitizeProviderText(init.rawBodyRedacted, 1000)
      : undefined;
    this.timestamp = new Date().toISOString();
  }

  toAttemptSummary(): ProviderAttemptSummary {
    return {
      provider: this.provider,
      statusCode: this.statusCode,
      providerErrorCode: this.providerErrorCode,
      providerMessage: this.providerMessage,
      retryable: this.retryable,
      timestamp: this.timestamp,
    };
  }
}

export interface ProviderAttemptSummary {
  provider: AIProviderName;
  statusCode: number;
  providerErrorCode?: string;
  providerMessage: string;
  retryable: boolean;
  timestamp: string;
}

export class AIOperationFailedError extends Error {
  readonly operation: string;
  readonly attempts: ProviderAttemptSummary[];
  readonly httpStatus: number;

  constructor(operation: string, attempts: ProviderError[]) {
    super(`No AI provider completed operation ${operation}.`);
    this.name = 'AIOperationFailedError';
    this.operation = operation;
    this.attempts = attempts.map(a => a.toAttemptSummary());
    this.httpStatus = resolveAggregateHttpStatus(attempts);
  }

  toJSON(): Record<string, unknown> {
    return {
      error: 'AI_PROVIDER_FAILED',
      message: this.message,
      operation: this.operation,
      attempts: this.attempts.map(a => ({
        provider: a.provider,
        statusCode: a.statusCode,
        providerErrorCode: a.providerErrorCode,
        providerMessage: a.providerMessage,
        retryable: a.retryable,
      })),
    };
  }
}

function resolveAggregateHttpStatus(attempts: ProviderError[]): number {
  if (attempts.length === 0) return 502;
  const codes = attempts.map(a => a.statusCode);
  if (codes.every(c => c === 429)) return 429;
  if (codes.some(c => c === 401 || c === 403)) return 403;
  if (codes.every(c => c === 400)) return 502;
  return 502;
}

function extractOpenAIError(body: unknown): { code?: string; message: string } {
  const data = body as { error?: { message?: string; type?: string; code?: string } };
  return {
    code: data.error?.code ?? data.error?.type,
    message: data.error?.message ?? 'OpenAI request failed',
  };
}

function extractAnthropicError(body: unknown): { code?: string; message: string } {
  const data = body as { error?: { type?: string; message?: string }; type?: string; message?: string };
  return {
    code: data.error?.type ?? data.type,
    message: data.error?.message ?? data.message ?? 'Anthropic request failed',
  };
}

function extractGeminiError(body: unknown): { code?: string; message: string } {
  const data = body as {
    error?: { code?: number; message?: string; status?: string };
    message?: string;
  };
  return {
    code: data.error?.status ?? String(data.error?.code ?? ''),
    message: data.error?.message ?? data.message ?? 'Gemini request failed',
  };
}

export async function providerErrorFromResponse(
  provider: AIProviderName,
  operation: string,
  response: Response,
): Promise<ProviderError> {
  const statusCode = response.status;
  const rawText = await response.text().catch(() => '');
  const sanitizedBody = sanitizeProviderText(rawText, 1000);

  let providerErrorCode: string | undefined;
  let providerMessage = `${provider} API error: ${statusCode}`;

  if (rawText) {
    try {
      const parsed = JSON.parse(rawText) as unknown;
      if (provider === 'openai') {
        const err = extractOpenAIError(parsed);
        providerErrorCode = err.code;
        providerMessage = err.message;
      } else if (provider === 'claude') {
        const err = extractAnthropicError(parsed);
        providerErrorCode = err.code;
        providerMessage = err.message;
      } else if (provider === 'gemini') {
        const err = extractGeminiError(parsed);
        providerErrorCode = err.code;
        providerMessage = err.message;
      }
    } catch {
      providerMessage = sanitizedBody || providerMessage;
    }
  }

  return new ProviderError({
    provider,
    operation,
    statusCode,
    providerErrorCode: providerErrorCode || undefined,
    providerMessage,
    rawBodyRedacted: sanitizedBody || undefined,
  });
}
