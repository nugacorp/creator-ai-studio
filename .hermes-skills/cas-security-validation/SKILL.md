---
name: cas-security-validation
description: Security validation for Creator AI Studio — protected routes 401, no fail-open auth, no secrets in logs, OAuth returnUrl blocking, path traversal on jobs, rate limits. Use before production promotion or after auth changes.
---

# CAS Security Validation

Structured security checks for the CAS API and worker. **Never print secret values** — verify presence and behavior only.

## Authentication

| Test | Expected |
|------|----------|
| `GET /api/episodes` without auth when `authRequired` | `401` |
| Same request with valid Supabase JWT or `CAS_API_KEY` | `200` |
| Invalid/expired token | `401`, no stack trace with env |
| Auth misconfigured (Supabase URL missing) | UI shows misconfiguration, API does not fail-open to anonymous write |

## Authorization & data isolation

- Users only see episodes they own (when Supabase metadata enabled).
- Admin/settings routes require authenticated session.

## OAuth safety

- External `returnUrl` parameters rejected or allowlisted.
- `CAS_PUBLIC_URL` matches browser origin for Google OAuth redirect.

## Job & filesystem safety

- Job payloads cannot escape `LOCAL_STORAGE_PATH` (path traversal attempts → rejected).
- Worker uses same `CAS_API_KEY` as API — verify header required, never log key.

## Error handling

- Global error handler returns generic messages to clients.
- Server logs must not contain API keys, tokens, or full Authorization headers.

## Rate limiting

- If enabled, verify excessive requests throttled (status 429) without leaking internals.

## Secret scan (repo / responses)

Search for **patterns only** — do not paste matches that look like real keys:

- `sk-`, `AIza`, `Bearer eyJ`, `service_role`
- Files: `.env`, `auth.json` must not be committed

Use grep with count/redaction; report file paths and line numbers without values.

## References

- [docs/02-operations/SUPABASE_AUTH.md](../../docs/02-operations/SUPABASE_AUTH.md)
- [apps/api/src/auth/](../../apps/api/src/auth/)
