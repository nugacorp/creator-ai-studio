# FASE 13 — Production Promotion (Hermes)

**Do not execute until FASE 12 E2E PASS.**

## Pre-merge gates

- [ ] `staging` clean, all PRs merged
- [ ] `npm run test` green
- [ ] `npm run typecheck` green
- [ ] `npm run build` green
- [ ] E2E checklist signed (see E2E_STAGING_CHECKLIST.md)
- [ ] No secrets in git diff
- [ ] `ALLOW_MOCKS=false` on staging verified

## Promotion steps

```bash
git checkout staging
git pull origin staging
git checkout main
git pull origin main
git merge staging
git tag -a v1.0.0-production-candidate -m "Production candidate after E2E PASS"
git push origin main
git push origin v1.0.0-production-candidate
```

## Deploy production

1. Trigger production deploy workflow (see `deploy-production.yml`)
2. Smoke `GET /api/health` on production URL
3. Login smoke test
4. Document rollback tag: `v1.0.0-production-candidate`

## Rollback

```bash
git checkout main
git revert <merge-commit>  # or reset to previous tag
git push origin main
# Redeploy previous production image tag in Coolify
```
