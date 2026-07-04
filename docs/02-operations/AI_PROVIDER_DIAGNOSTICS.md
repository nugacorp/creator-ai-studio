# AI Provider Diagnostics and Fallback

**Work order:** CAS-CURSOR-WO-0033  
**Audience:** Operators and Hermes E2E validation

## Overview

Creator AI Studio routes AI operations (script, chat, image, etc.) through a gateway with structured errors, per-provider smoke tests, and configurable fallback between Gemini, OpenAI, and Anthropic.

## Selecting a provider

Resolution order (first match wins):

1. `provider` field in the API request body (e.g. `{ "provider": "openai" }`)
2. Persisted setting `aiProviderDefault` in Configuración (`settings.json`)
3. Per-operation env var: `AI_SCRIPT_PROVIDER`, `AI_CHAT_PROVIDER`, `AI_IMAGE_PROVIDER`, etc.
4. `AI_PROVIDER_DEFAULT`
5. Default: `gemini`

## Model configuration

| Variable | Default | Purpose |
|---|---|---|
| `GEMINI_MODEL` | `gemini-2.0-flash` | Gemini text |
| `GEMINI_IMAGE_MODEL` | `imagen-3.0-generate-002` | Gemini images |
| `OPENAI_MODEL` | `gpt-4o-mini` | OpenAI chat/script |
| `OPENAI_IMAGE_MODEL` | `dall-e-3` | OpenAI images |
| `ANTHROPIC_MODEL` | `claude-3-5-sonnet-20241022` | Claude messages |

Hermes reported HTTP 400 with `claude-sonnet-4-20250514` — that model may not exist for your account. Set `ANTHROPIC_MODEL` to a model your Anthropic project supports.

## Fallback

```env
AI_FALLBACK_ENABLED=true
AI_FALLBACK_ORDER=gemini,openai,claude
```

When the primary provider fails with **401**, **403**, **429**, or **400** (invalid request), the gateway tries the next **configured** provider in `AI_FALLBACK_ORDER`.

If all providers fail, the API returns **502** (or **429** / **403** when all attempts share that status) with a sanitized `attempts` array — never raw API keys.

Demo mode is **not** used automatically. Enable only for local/dev:

```env
AI_ALLOW_DEMO_FALLBACK=true
```

## Diagnostics endpoints

### Provider status

```http
GET /api/ai/providers/status
```

Returns configured state and last error per provider (no secrets).

### Per-provider smoke test

```http
POST /api/ai/providers/gemini/test
Content-Type: application/json

{
  "operation": "script",
  "prompt": "Responde exactamente: CAS_TEST_OK"
}
```

Also accepts `openai` and `claude` (alias `anthropic` → `claude`). Does not create episodes or pipeline artifacts.

## HTTP status codes from providers

| Upstream | Typical cause |
|---|---|
| **403** | Invalid API key, OAuth without Gemini scope, project without API enabled |
| **429** | OpenAI/Anthropic quota or rate limit |
| **400** | Invalid model name, malformed request, `max_tokens` issues |

Errors are returned as **502 Bad Gateway** (provider failure) with `providerMessage` sanitized. Credential failures may return **403**; all-rate-limit failures return **429**.

## Example: script generation with fallback

```http
POST /api/ai/generate-script
Content-Type: application/json

{
  "prompt": "Responde exactamente: CAS_GEMINI_TEST_OK"
}
```

On failure:

```json
{
  "error": "AI_PROVIDER_FAILED",
  "message": "No AI provider completed operation script.",
  "operation": "script",
  "attempts": [
    { "provider": "gemini", "statusCode": 403, "providerMessage": "..." },
    { "provider": "openai", "statusCode": 429, "providerMessage": "..." }
  ]
}
```

## Related

- Secrets UI: `POST /api/secrets/test/:provider` (connectivity only)
- System mode: `GET /api/system/mode` (`demoMode`, active provider)
