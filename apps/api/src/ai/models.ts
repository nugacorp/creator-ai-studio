import process from 'node:process';

/** Text generation model for Gemini. Override with GEMINI_MODEL. */
export function getGeminiTextModel(): string {
  return process.env.GEMINI_MODEL ?? 'gemini-2.0-flash';
}

/** Image generation model for Gemini. Override with GEMINI_IMAGE_MODEL. */
export function getGeminiImageModel(): string {
  return process.env.GEMINI_IMAGE_MODEL ?? 'imagen-3.0-generate-002';
}

/** Chat/completions model for OpenAI. Override with OPENAI_MODEL. */
export function getOpenAIModel(): string {
  return process.env.OPENAI_MODEL ?? 'gpt-4o-mini';
}

/** OpenAI image model. Override with OPENAI_IMAGE_MODEL. */
export function getOpenAIImageModel(): string {
  return process.env.OPENAI_IMAGE_MODEL ?? 'dall-e-3';
}

/**
 * Anthropic messages model. Override with ANTHROPIC_MODEL.
 * Default is claude-3-5-sonnet-20241022 (widely available). Hermes reported 400 with
 * claude-sonnet-4-20250514 — set ANTHROPIC_MODEL if your account supports a newer model.
 */
export function getAnthropicModel(): string {
  return process.env.ANTHROPIC_MODEL ?? 'claude-3-5-sonnet-20241022';
}
