---
name: cas-ai-provider-validation
description: Validate real OpenAI/Claude/Gemini providers for Creator AI Studio — /api/ai/providers/status, per-provider smoke, demoMode=false, sanitized errors. Use before agent runs or E2E on staging.
---

# CAS AI Provider Validation

Confirm **real** AI providers work; demo fallback must not mask failures on staging/production validation.

## Environment flags

| Flag | Staging validation | Production |
|------|-------------------|------------|
| `AI_ALLOW_DEMO_FALLBACK` | `false` | `false` |
| `demoMode` in settings | `false` | `false` |

## Steps

1. **Status endpoint** (authenticated):

   `GET /api/ai/providers/status`

   Expect configured providers listed without exposing key material.

2. **Settings UI smoke** (preferred for operators):

   Configuración → proveedor (OpenAI/Gemini/Claude) → **Probar**  
   Expect success message, not demo placeholder text.

3. **Minimal chat smoke** (if WO allows):

   `POST /api/ai/chat` with short prompt — response must be real model output when keys valid.

4. **Failure case**: invalid/missing key → HTTP error with **sanitized** message (no key substrings, no stack with env vars).

## Provider-specific notes

- **OpenAI**: default on staging after CAS-HERMES-VAL; verify billing active if 429/quota errors.
- **Gemini**: requires `GEMINI_API_KEY` or Settings UI key with `CAS_SECRETS_KEY`.
- **Claude**: requires Anthropic key in secrets store.

## Do not

- Run full agent pipeline or Hermes orchestration as part of this skill unless WO extends scope.
- Set `AI_ALLOW_DEMO_FALLBACK=true` to "pass" validation.
- Log Authorization headers or request bodies containing keys.

## References

- [docs/02-operations/AI_PROVIDER_DIAGNOSTICS.md](../../docs/02-operations/AI_PROVIDER_DIAGNOSTICS.md)
- [docs/02-operations/AI_CREDENTIALS_CHECKLIST.md](../../docs/02-operations/AI_CREDENTIALS_CHECKLIST.md)
