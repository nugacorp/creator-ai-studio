---
name: cas-supabase-auth-ops
description: Supabase auth operations for Creator AI Studio — login flow, health, JWT usage without printing tokens, settings/profile, key rotation before production.
---

# CAS Supabase Auth Operations

Operate and validate **Supabase authentication** for the CAS web app and API.

## Configuration (names only)

| Variable | Service |
|----------|---------|
| `SUPABASE_URL` | API, Web build (`VITE_SUPABASE_URL`) |
| `SUPABASE_ANON_KEY` | Web client |
| `SUPABASE_SERVICE_ROLE_KEY` | API server only — never expose to browser |
| `SUPABASE_JWT_SECRET` | API JWT verification (if used) |

Never print values. Confirm **set/non-empty** via deploy env UI or `hermes doctor`-style presence checks.

## Validation steps

1. **Web login**: LoginView → email/password or magic link → session established.
2. **Protected API**: `fetch('/api/episodes', { headers: { Authorization: 'Bearer <session>' } })` → 200.
3. **Without token**: 401 when `authRequired: true`.
4. **Profile**: Settings profile loads display name; updates persist.
5. **Health**: Supabase project reachable; no CORS misconfig on staging URL.

## JWT handling

- Use session `access_token` from Supabase client for API calls.
- Reports may say "JWT present" or "JWT rejected" — **never paste token strings**.
- Rotate anon/service keys before production per [SUPABASE_AUTH.md](../../docs/02-operations/SUPABASE_AUTH.md).

## Misconfiguration

If Supabase env missing on web build → `AuthMisconfiguredView` blocks app. Fix Coolify build args / env and redeploy web.

## Scripts

- `scripts/supabase-setup.ps1` — local/dev setup (not for printing secrets)
- `scripts/vps-sync-supabase-env.sh` — VPS env sync (sanitized output only)

## References

- [docs/02-operations/SUPABASE_AUTH.md](../../docs/02-operations/SUPABASE_AUTH.md)
- [apps/web/src/context/AuthContext.tsx](../../apps/web/src/context/AuthContext.tsx)
