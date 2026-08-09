## Document ID

ROADMAP

## Title

Roadmap

## Version

2.2.0

## Status

Active

## Author

Hermes

## Created

2026-06-25

## Last Updated

2026-08-09

## Purpose

Mantener el roadmap operativo vigente de Creator AI Studio después del pivote a plataforma del equipo digital de iglesia.

## Scope

### Ramas y operación de repositorio

| Área | Estado | Siguiente control |
|---|---|---|
| `main` | Restaurada como rama estable/producción y alineada con `origin/main` @ `b12f812` | Proteger branch en GitHub |
| `staging` | Restaurada/publicada desde `origin/main` @ `b12f812` | Proteger branch y usar PRs |
| Worktrees IA | Directorio operativo creado en `/home/creator/worktrees/creator-ai-studio` | Crear un worktree por tarea/agente |
| Gobierno multiagente | `AGENTS.md` actualizado | Hacer cumplir vía PR y Work Orders |

### Roadmap funcional vigente

| Fase | Nombre | Estado | Nota |
|---|---|---|---|
| G0 | Saneamiento Git y gobierno multiagente | En progreso | Esta rama establece reglas y documentos base |
| G1 | Branch protections y PR workflow | Pendiente | Requiere configuración en GitHub por owner/admin |
| P1 | Church Public Portal V1 | Propuesto | Ver `docs/03-product/CHURCH_PUBLIC_PORTAL_V1_PLAN.md` |
| O1 | Staging verificable desde `staging` | Pendiente | Requiere push/merge controlado y validación Coolify |
| O2 | Producción real con dominio/HTTPS | Pendiente | Requiere app Coolify/secretos/domino/protecciones |

### Roadmap histórico pre-pivote

Las fases 0–7 del producto anterior se conservan como historial y no deben presentarse como objetivo funcional actual sin revalidación contra `PROJECT_STATE.md`.

## Dependencies

PROJECT_STATE.md, AGENTS.md

## Related Documents

MASTER_INDEX.md, CHANGELOG.md, DOCUMENT_REGISTRY.md, docs/03-product/CHURCH_PUBLIC_PORTAL_V1_PLAN.md

## Change History

| Date | Version | Author | Change |
|---|---:|---|---|
| 2026-06-25 | 0.1.0 | Hermes | Initial roadmap created. |
| 2026-06-25 | 1.0.0 | Hermes | Defined original phases 0–7. |
| 2026-08-09 | 2.2.0 | Hermes | Reframed roadmap around post-pivot repo governance, restored `staging`, branch protections, and Church Public Portal V1. |
