# Branch protection — main / staging

## Estado actual

Las ramas `main` y `staging` son oficiales pero **no están protegidas** en GitHub. Cualquier push directo o merge sin revisión es posible.

## Acción manual requerida (GitHub admin)

### main

- Settings → Branches → Add rule
- Branch name pattern: `main`
- ✅ Require a pull request before merging
  - Required approvals: **1**
  - Dismiss stale approvals on new commits: ✅
- ✅ Require status checks to pass before merging
  - ci / typecheck, ci / test, ci / build
- ✅ Require linear history (squash or rebase merges)
- ❌ Allow force pushes (off)
- ❌ Allow deletions (off)

### staging

Mismas reglas con **1 aprobación** y CI checks. Staging es el punto de integración pre-producción.

## Por qué

- `main` corresponde a producción real (D-7 de PROJECT_STATE).
- `staging` se acaba de restaurar desde `origin/main` el 2026-08-09 (commit `b12f812`).
- Los agentes IA trabajan en worktrees; sin protección, un push accidental a `main`/`staging` rompe el flujo.

## Verificación post-acción

```bash
gh api repos/nugacorp/creator-ai-studio/branches/main/protection | jq .enabled
# esperado: true

gh api repos/nugacorp/creator-ai-studio/branches/staging/protection | jq .enabled
# esperado: true
```

## Bloqueador

Requiere un owner/admin del repositorio. No es automatizable desde un worktree.
