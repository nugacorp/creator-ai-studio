## Document ID

TECH_STACK

## Title

Technology Stack and Deployment Strategy

## Version

0.1.0

## Status

Draft

## Author

Claude Code

## Created

2026-06-25

## Last Updated

2026-06-25

## Purpose

Document the branching model, role responsibilities, and deployment strategy for Creator AI Studio.

## Scope

This document defines how code flows from development to production and which platforms and roles support that flow. It does not introduce or change any application functionality.

### Branching Model

Creator AI Studio uses a three-tier branching model:

| Branch | Environment | Purpose |
|---|---|---|
| `main` | Production | Stable, release-ready state. Always deployable. |
| `staging` | Testing / Integration | Validation and integration before promotion to production. |
| `feature/*` | Development | Isolated branches for individual development tasks. |

Promotion flow:

1. Development happens on `feature/*` branches.
2. Validated features are merged into `staging` for integration testing.
3. After validation in `staging`, changes are promoted to `main` (production).

### Roles

| Role | Responsibility |
|---|---|
| Claude Code | Develops on `feature/*` branches and prepares changes for validation. |
| Hermes | Validates, executes, and deploys to the VPS. |

- **Claude Code develops**: implements changes on `feature/*` branches.
- **Hermes validates, executes, and deploys** the validated changes on the VPS.

### Deployment Strategy

| Environment | Branch | Platform |
|---|---|---|
| Production | `main` | Stable production state on the VPS. |
| Staging | `staging` | Coolify (recommended) on the VPS. |

- **Coolify** is the recommended deployment platform for the `staging` environment, providing a self-hosted PaaS layer on the VPS for testing and integration.
- `main` represents the stable production state and is deployed only after validation in `staging`.

### Operational Rules

- No force push to shared branches (`main`, `staging`).
- No deletion of shared branches.
- Secrets are never committed to the repository.

## Dependencies

DOCUMENTATION_STANDARD.md

## Related Documents

README.md, DOCUMENT_REGISTRY.md, PROJECT_REGISTRY.json

## Change History

| Date | Version | Author | Change |
|---|---:|---|---|
| 2026-06-25 | 0.1.0 | Claude Code | Initial technology stack and deployment strategy document created. |
