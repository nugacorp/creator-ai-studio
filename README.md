## Document ID

README

## Title

Creator AI Studio Repository Entry Point

## Version

0.2.0

## Status

Draft

## Author

Hermes

## Created

2026-06-25

## Last Updated

2026-06-25

## Purpose

Provide the initial repository entry point for Creator AI Studio during Phase 0: Blueprint.

## Scope

This repository currently contains the CAS OS documentation infrastructure only.

Official entry points:

- [MASTER_INDEX.md](MASTER_INDEX.md)
- [PROJECT_STATE.md](PROJECT_STATE.md)
- [ROADMAP.md](ROADMAP.md)
- [CHANGELOG.md](CHANGELOG.md)
- [DOCUMENT_REGISTRY.md](DOCUMENT_REGISTRY.md)
- [PROJECT_REGISTRY.json](PROJECT_REGISTRY.json)

### Branching and Deployment Strategy

Creator AI Studio uses a three-tier branching model. No functionality is changed by adopting this model; it only governs how work flows from development to production.

| Branch | Environment | Purpose |
|---|---|---|
| `main` | Production | Stable, release-ready state. Always deployable. |
| `staging` | Testing / Integration | Validation and integration before promotion to production. |
| `feature/*` | Development | Isolated branches for individual development tasks. |

Work flow:

1. Development happens on `feature/*` branches.
2. Validated features are integrated into `staging` for testing.
3. After validation in `staging`, changes are promoted to `main` (production).

Roles:

- **Claude Code** develops on `feature/*` branches and prepares changes.
- **Hermes** validates, executes, and deploys to the VPS.

Deployment:

- **Coolify** is the recommended deployment platform for the `staging` environment on the VPS.
- `main` represents the stable production state.

Operational rules:

- No force push to shared branches (`main`, `staging`).
- No deletion of shared branches.
- Secrets are never committed to the repository.

For the full rationale and platform details, see [docs/01-architecture/TECH_STACK.md](docs/01-architecture/TECH_STACK.md).

## Dependencies

None

## Related Documents

MASTER_INDEX.md, PROJECT_STATE.md, docs/01-architecture/TECH_STACK.md

## Change History

| Date | Version | Author | Change |
|---|---:|---|---|
| 2026-06-25 | 0.1.0 | Hermes | Initial repository entry point created. |
| 2026-06-25 | 0.1.0 | Hermes | Normalized document to official documentation standard. |
| 2026-06-25 | 0.2.0 | Claude Code | Added branching and deployment strategy (main / staging / feature). |
