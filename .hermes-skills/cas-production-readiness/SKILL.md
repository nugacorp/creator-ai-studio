---
name: cas-production-readiness
description: "Creator AI Studio: production readiness checklist for real production, no mocks/demo fallback."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [creator-ai-studio, production, readiness, ops]
---

# CAS Production Readiness

Use when preparing or validating Creator AI Studio for real production.

## Inputs needed
- Target environment: staging or production.
- Expected commit SHA.
- Public URL.
- Explicit Work Order scope.

## Safety rules
- Never print secrets, API keys, OAuth tokens, CAS_API_KEY, cookies, or Authorization headers.
- Do not touch `main` unless the Work Order explicitly authorizes production promotion.
- Do not use mocks, demo mode, or demo fallback for production gates.
- Do not publish to YouTube without explicit human authorization.

## Allowed commands/checks
- `git status`, `git log`, `git rev-parse`, `git fetch` when repo inspection is needed.
- `npm run test`, `npm run typecheck`, `npm run build`.
- Public health checks such as `GET /api/health`.
- Container/service status checks that do not reveal env values.

## Prohibited commands/actions
- No pipeline, TTS, render, shorts, publish, or confirm-publish unless the Work Order explicitly scopes it.
- No environment variable changes.
- No secret printing or raw env dumps.
- No force push.

## Checklist
1. Confirm deployed commit meets minimum expected SHA.
2. Confirm `demoMode=false`.
3. Confirm `AI_ALLOW_DEMO_FALLBACK=false`.
4. Confirm mocks are not allowed for production gates.
5. Confirm auth-required routes fail closed with 401 when unauthenticated.
6. Confirm API, web, worker, and Redis are up.
7. Validate real AI provider before any production pipeline.
8. Validate real TTS before render readiness.
9. Validate render artefact exists before publish readiness.
10. Validate YouTube OAuth/scopes and human publish authorization gate.
11. Validate Google Drive/rclone/archive path and rollback plan.
12. Confirm domain/HTTPS and rollback procedure.

## Delivery format
Report: Status, commit, services, health, mode flags, provider/TTS/render/publish readiness, blockers, next recommendation.
