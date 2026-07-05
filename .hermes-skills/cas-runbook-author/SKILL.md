---
name: cas-runbook-author
description: "Author and maintain Creator AI Studio operational documentation and runbooks without secrets."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [creator-ai-studio, documentation, runbook, changelog, operations]
---

# CAS Runbook Author

Use when updating Creator AI Studio operational documentation.

## Inputs needed
- Work Order ID.
- Files authorized for documentation updates.
- Source facts/evidence from validation or deploy.

## Safety rules
- Never write secrets, tokens, passwords, API keys, CAS_API_KEY, or Authorization headers into docs.
- Do not modify protected/source docs unless authorized.
- Do not invent validation results; cite actual tool output or mark unknown.
- Do not change architecture/business decisions without Product Owner or Architect authorization.

## Documents commonly maintained
- CHANGELOG.
- RUNBOOK.
- DEPLOYMENT_STAGING.
- PRODUCTION_READINESS.
- rollback instructions.
- backup/restore procedures.
- environment variable inventory with names only, no values.
- DOCUMENT_REGISTRY and ADRs when scoped.

## Checklist
1. Confirm authorized files and scope.
2. Read current docs before editing.
3. Apply minimal, traceable updates.
4. Include date, Work Order ID, commit/environment when relevant.
5. Document rollback and operational risks.
6. Do not include secret values.
7. Verify markdown formatting.
8. Report files created/modified.

## Delivery format
Estado, Resumen, Archivos creados, Archivos modificados, Documentación actualizada, Inconsistencias detectadas, Siguiente paso recomendado.
