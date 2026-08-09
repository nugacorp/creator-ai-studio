# AGENTS.md

## Propósito

Este archivo define las reglas operativas para humanos y agentes IA que trabajen en Creator AI Studio. Es obligatorio para Hermes, Codex, Claude, Cursor y cualquier otro agente que edite este repositorio.

Creator AI Studio es un monorepo npm workspaces (Node >= 20) para la plataforma operativa del equipo digital de una iglesia. El repositorio contiene API Fastify, web React/Vite, worker de producción, tipos compartidos, migraciones Supabase, despliegue y documentación de gobierno.

## Fuente de verdad y rol de documentos

- Estado oficial del proyecto: `PROJECT_STATE.md` en la raíz.
- Gobierno documental: `docs/00-governance/`.
- Producto/planes funcionales: `docs/03-product/`.
- Operaciones/runbooks/evidencia: `docs/02-operations/`.
- Arquitectura/despliegue: `docs/01-architecture/`.

No crees fuentes de verdad duplicadas. Si un documento histórico queda obsoleto, márcalo como snapshot/puntero en lugar de mantener dos versiones activas.

## Ramas oficiales

- `main`: rama estable/producción. Debe estar protegida. No se trabaja directo aquí.
- `staging`: integración/preproducción. Debe estar protegida. Coolify staging y validaciones operativas deben apuntar aquí.
- `feature/*`: nuevas funcionalidades.
- `fix/*`: correcciones.
- `docs/*`: documentación y gobierno.
- `ops/*`: infraestructura/despliegue.
- `agent/*`: trabajo explícitamente aislado de agentes IA.
- `archive/*`: preservación histórica; no se usa para desarrollo activo.

Todo cambio normal debe salir de una rama corta y entrar por Pull Request. No hagas push directo a `main` ni `staging` salvo autorización explícita del Product Owner.

## Worktrees obligatorios para agentes

El clone oficial local es:

`/home/creator/projects/creator-ai-studio`

Los agentes deben trabajar en worktrees bajo:

`/home/creator/worktrees/creator-ai-studio/`

Ejemplo:

```bash
git fetch origin
git worktree add /home/creator/worktrees/creator-ai-studio/hermes-wo-001 \
  -b docs/hermes/wo-001 origin/staging
```

No trabajes varios agentes en el mismo directorio ni en la misma rama.

## Roles de agentes

### Hermes

- Rol: Chief PMO & Document Controller, coordinación, validación y reporte.
- Puede actualizar documentos de control solo con Work Order/autorización explícita.
- No decide estrategia de producto, arquitectura o negocio por iniciativa propia.
- No hace merge, deploy, push a ramas protegidas ni publicación externa sin autorización explícita.

### Codex / agentes de implementación

- Rol: implementación, tests, correcciones técnicas.
- Usar ramas `feature/codex/*`, `fix/codex/*` o `agent/codex/*`.
- No modificar documentos de gobierno salvo que el scope lo autorice.

### Claude / agentes de arquitectura o revisión

- Rol: revisión, refactor o arquitectura bajo autorización.
- Usar ramas `review/claude/*`, `refactor/claude/*`, `feature/claude/*` o `agent/claude/*`.
- Debe dejar evidencia de decisiones arquitectónicas en ADR/documentos autorizados.

## Reglas de scope

- Respeta el alcance de la Work Order.
- No hagas cambios “de paso”.
- No cambies decisiones de negocio, producto o arquitectura sin autorización.
- No introduzcas mocks/demo como evidencia de producción.
- No ejecutes pipeline, TTS, render, publicación, YouTube upload ni `confirm-publish` sin autorización explícita.
- No imprimas secretos ni tokens en logs o respuestas.
- No modifiques `main` directamente.
- No uses `git push --force` salvo orden explícita y justificación.

## Commits y Pull Requests

Formato de commit:

```text
type: concise subject
```

Tipos válidos: `docs`, `fix`, `feat`, `ops`, `test`, `refactor`, `chore`.

Ejemplos:

```text
docs: establish multi-agent repository governance
fix: restore church API healthcheck validation
ops: prepare Coolify staging deployment
```

PRs deben incluir:

- Objetivo y Work Order relacionada.
- Rama base y rama origen.
- Resumen de cambios.
- Archivos modificados.
- Validaciones ejecutadas con resultado real.
- Riesgos y rollback.
- Confirmación de que no se expusieron secretos.

## Servicios locales

| Service | Location | Run (dev) | Notes |
|---|---|---|---|
| API | `apps/api` (`@creator-ai-studio/api`) | `npm run start --workspace @creator-ai-studio/api` | Fastify en puerto `3000`. Ejecuta `node dist/server.js`; debe compilarse antes (`npm run build --workspace @creator-ai-studio/api` o build raíz). |
| Web | `apps/web` (`@creator-ai-studio/web`) | `npm run dev --workspace @creator-ai-studio/web` | Vite en puerto `5173` con HMR. |
| Worker | `workers/production` (`@creator-ai-studio/production-worker`) | `npm run start --workspace @creator-ai-studio/production-worker` | Polling de `/jobs/pending` cada 5s. Debe compilarse antes. |

## Gotchas no obvios

### Local dev: same-origin API

La web usa `VITE_API_BASE_URL` con default `/api`. En producción nginx sirve la SPA y proxya `/api` al contenedor API. En desarrollo, `apps/web/vite.config.ts` debe mantener proxy `/api` -> `http://127.0.0.1:3000`.

```bash
npm run build --workspace @creator-ai-studio/api
npm run start --workspace @creator-ai-studio/api
npm run dev --workspace @creator-ai-studio/web
```

Mantén `VITE_API_BASE_URL=/api` o unset. No apuntes a `http://localhost:3000/api` salvo que agregues CORS al API.

Síntomas de mala configuración: requests cross-origin fallan y la UI puede caer silenciosamente a datos demo (por ejemplo “David vs Goliat”, KPIs falsos o canales placeholder).

### Storage de episodios

`LOCAL_STORAGE_PATH` default es `episodes/`, resuelto relativo al cwd del proceso. Si el API se inicia desde workspace, los datos caen en `apps/api/episodes/` y están ignorados por Git.

### Límite de episodios activos

`maxActiveEpisodes` default es `1`. Crear un segundo episodio activo devuelve HTTP `409` hasta archivar/publicar el primero o cambiar settings con autorización.

### Jobs de render/pipeline

`render`, `shorts` y `pipeline` requieren `ffmpeg` y credenciales/integraciones reales. Sin esos extras pueden fallar de forma esperada mientras el worker sigue operativo.

## Quality gates

Desde la raíz del repo:

```bash
npm run typecheck
npm run test
npm run build
```

No declares listo un cambio de código sin ejecutar gates reales o explicar claramente el bloqueo. Para cambios solo documentales, valida al menos JSON/YAML, links internos razonables y `git status`.

## Formato final requerido para Hermes en tareas CAS

- Estado
- Resumen
- Archivos creados
- Archivos modificados
- Documentación actualizada
- Inconsistencias detectadas
- Siguiente paso recomendado
