---
name: cas-security-validation
description: "Creator AI Studio security validation gates: auth, fail-closed behavior, OAuth, jobs, logs, and secrets hygiene."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [creator-ai-studio, security, auth, oauth, hardening]
---

# CAS Security Validation

Use for security-hardening smoke tests and production security gates.

## Inputs needed
- Target URL/environment.
- Authorized scope.
- Expected commit.
- Safe authenticated method if protected routes must be tested.

## Safety rules
- Never print secrets, tokens, CAS_API_KEY, cookies, or Authorization headers.
- Do not run destructive scans or broad pentests unless separately authorized.
- Do not change environment variables or Coolify config.
- Do not run pipeline/publish.

## Checklist
1. Public health works: `/api/health` returns 200.
2. Protected routes without auth return 401, not 200/500.
3. Protected routes with valid auth work without printing tokens.
4. Production fail-open is disabled.
5. `demoMode=false` for production gates.
6. Secret values are masked in settings/status outputs.
7. Logs do not expose secrets or Authorization headers.
8. OAuth external/unsafe `returnUrl` is blocked.
9. Job IDs reject path traversal and invalid UUIDs.
10. Rate limit/security headers are active where expected.
11. Error handler does not leak internals/stacks in production responses.
12. Secret scan uses redaction and never prints matched values.

## Allowed commands
- Targeted curl/API checks with redacted headers.
- Container logs filtered for error markers, not raw env.
- Test suite and security-specific tests.

## Delivery format
Status, commit, routes tested, auth results, OAuth/jobs/rate-limit/logs results, sanitized issues, next recommendation.
