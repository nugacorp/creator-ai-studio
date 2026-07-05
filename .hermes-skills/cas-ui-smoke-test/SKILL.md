---
name: cas-ui-smoke-test
description: UI smoke test for Creator AI Studio web dashboard — login, sidebar, header, projects, workspace, episode creation if authorized. No IA pipeline. Use after deploy or frontend changes.
---

# CAS UI Smoke Test

Manual or browser-automation smoke of the **web dashboard** without invoking AI production pipeline.

## Staging URL

`https://creator-ai-studio.217.76.56.66.sslip.io`

Use Playwright skill (`playwright` hub skill) or browser tools when automating.

## Checklist

| # | Step | Pass |
|---|------|------|
| 1 | Load home / dashboard | Greeting + Panel del Creador visible |
| 2 | Sidebar | All nav items render; click Proyectos, Agentes, Configuración |
| 3 | Header | Channel selector, notifications area present |
| 4 | Login (if auth required) | Supabase login → dashboard accessible |
| 5 | Proyectos | Pipeline board loads; columns visible |
| 6 | Dashboard stats | Clickable cards navigate (episodios → proyectos, programados → calendario) |
| 7 | Open workspace | Select episode → workspace tabs (Guion, Narración, etc.) |
| 8 | Create episode | Only if WO authorizes — new episode appears in list |
| 9 | Move stage | Only if WO authorizes — card moves between columns |
| 10 | Console | No uncaught errors on critical paths |
| 11 | Network | `/api/health` 200; authenticated `/api/episodes` 200 |

## Do not

- Trigger Hermes agent runs, TTS, render, or YouTube publish.
- Store or log Supabase session tokens in reports.

## Clickable dashboard (v0.4+)

Home stats map to:

- Episodios activos → Proyectos (filtered)
- Con guion → Workspace guion tab (single episode) or filtered board
- En producción → Proyectos / workspace production tabs
- Miniaturas listas → Miniatura tab or filtered board
- Programados → Calendario

## References

- [apps/web/src/components/HomeView.tsx](../../apps/web/src/components/HomeView.tsx)
- `.claude/skills/playwright-web-testing/SKILL.md` (Cursor/Claude Playwright)
