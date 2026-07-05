---
name: cas-runbook-author
description: Author and update Creator AI Studio operational docs — CHANGELOG, RUNBOOK, DEPLOYMENT_STAGING, PRODUCTION_READINESS — variable names without values, no secrets, rollback and backup procedures.
---

# CAS Runbook Author

Create or update **operational documentation** for Creator AI Studio. Documentation is versioned in `docs/`; this skill defines quality bars.

## Documents you may update (when WO authorizes)

| Doc | Path |
|-----|------|
| CHANGELOG | [docs/00-governance/CHANGELOG.md](../../docs/00-governance/CHANGELOG.md) |
| RUNBOOK | [docs/02-operations/RUNBOOK.md](../../docs/02-operations/RUNBOOK.md) |
| DEPLOYMENT_STAGING | [docs/01-architecture/DEPLOYMENT_STAGING.md](../../docs/01-architecture/DEPLOYMENT_STAGING.md) |
| PRODUCTION_PROMOTION | [docs/02-operations/PRODUCTION_PROMOTION.md](../../docs/02-operations/PRODUCTION_PROMOTION.md) |
| PROJECT_STATE | [docs/00-governance/PROJECT_STATE.md](../../docs/00-governance/PROJECT_STATE.md) |
| E2E checklists | [docs/02-operations/E2E_STAGING_CHECKLIST.md](../../docs/02-operations/E2E_STAGING_CHECKLIST.md) |

## Writing rules

1. **Variable names only** — e.g. `CAS_API_KEY`, `GEMINI_API_KEY`; never example real keys.
2. **Placeholders** — `<your-domain>`, `<episode-id>`, `<Bearer token>`.
3. **Commands** — copy-paste safe; no embedded secrets.
4. **Version headers** — bump `Last Updated` and semver where doc template requires.
5. **Rollback** — every deploy doc mentions Coolify rollback + persistent volume path.
6. **Backup** — episode data at `LOCAL_STORAGE_PATH`; note Supabase sync if enabled.

## Standard sections for runbook entries

- Purpose / scope
- Preconditions
- Steps (numbered)
- Verification
- Rollback
- Related docs

## After doc changes

If WO includes repo commit:

```bash
npm run test
npm run typecheck
npm run build
```

Docs-only changes should still pass gates (no runtime breakage).

## Do not

- Commit `.env`, credentials, or auth.json.
- Document secret values "for convenience".
- Change production Coolify config in the same WO unless explicitly scoped.

## References

- [docs/templates/document-template.md](../../docs/templates/document-template.md)
- [docs/00-governance/DOCUMENT_REGISTRY.md](../../docs/00-governance/DOCUMENT_REGISTRY.md)
