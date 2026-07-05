---
name: cas-ai-provider-validation
description: "Validate real Creator AI Studio AI providers without exposing secrets or running the pipeline."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [creator-ai-studio, ai-providers, openai, claude, gemini, staging]
---

# CAS AI Provider Validation

Use when validating real AI providers in staging/production readiness.

## Inputs needed
- Staging/production URL.
- Expected commit.
- Authorization to call provider smoke endpoints.

## Safety rules
- Never print API keys, OAuth tokens, CAS_API_KEY, cookies, or Authorization headers.
- Run API probes from inside API container or secure authenticated context.
- Report only sanitized provider messages/status codes.
- Do not persist content unless explicitly authorized.
- Do not execute pipeline, TTS, render, shorts, publish, or confirm-publish.

## Required preflight
1. `GET /api/health`.
2. `GET /api/system/mode`.
3. `GET /api/ai/providers/status`.
4. Confirm `demoMode=false`.
5. Confirm `AI_ALLOW_DEMO_FALLBACK=false`.
6. Confirm fallback setting/order without printing secrets.

## Provider smoke endpoints
- `POST /api/ai/providers/openai/test` with operation `script` and marker prompt.
- `POST /api/ai/providers/claude/test` with operation `script` and marker prompt.
- `POST /api/ai/providers/gemini/test` with operation `script` and marker prompt.

Test only configured providers. Prefer OpenAI, then Claude, then Gemini for `AI_SCRIPT_PROVIDER` if a provider responds OK.

## Generate-script smoke
Only after/alongside provider validation, call `/api/ai/generate-script` with a very short non-persistent prompt. Validate: HTTP success, text generated, provider used, not demo, not mock, no quota/scope/saldo error.

## Delivery format
Status, commit, services, health, mode, providers status, OpenAI/Claude/Gemini results, selected provider, `AI_SCRIPT_PROVIDER` configured yes/no, generate-script result, sanitized errors, next recommendation.
