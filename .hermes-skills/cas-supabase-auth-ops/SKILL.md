---
name: cas-supabase-auth-ops
description: "Creator AI Studio Supabase/Auth operational validation without token disclosure."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [creator-ai-studio, supabase, auth, jwt, operations]
---

# CAS Supabase Auth Ops

Use for Supabase health, authentication, JWT, and profile/settings operations.

## Inputs needed
- Environment URL.
- Safe login method or test account authorization.
- Scope of auth routes/settings to validate.

## Safety rules
- Never print JWTs, refresh tokens, cookies, passwords, service_role key, anon key, or Authorization headers.
- Do not change Supabase settings or secrets unless explicitly authorized.
- Do not create/delete users unless the Work Order authorizes it.

## Checklist
1. Validate `/api/health` reports Supabase OK.
2. Validate public auth/status/mode routes as expected.
3. Validate login through UI or safe API path.
4. Validate protected route without auth returns 401.
5. Validate protected route with auth returns expected data without printing token.
6. Validate JWT priority/sync behavior if in scope.
7. Validate settings/profile endpoints if present.
8. Confirm no service_role leakage in logs or responses.
9. Confirm production rotation checklist before launch.

## Allowed commands
- Browser UI login smoke.
- API calls using tokens stored only in runtime variables and never echoed.
- Container-internal checks that do not dump env.

## Delivery format
Status, health, login, protected route without/with auth, settings/profile result, sanitized errors, rotation reminders, next recommendation.
