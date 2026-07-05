---
name: cas-ui-smoke-test
description: "Creator AI Studio public UI smoke validation without running AI or production pipeline."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [creator-ai-studio, ui, smoke, staging, browser]
---

# CAS UI Smoke Test

Use when validating the public staging UI after deploys or UI fixes.

## Inputs needed
- Public URL.
- Expected commit/deploy context.
- Safe login method or authorization for temporary smoke account.

## Safety rules
- Never print passwords, session tokens, cookies, JWTs, API keys, or Authorization headers.
- Do not execute IA, TTS, render, shorts, publish, or pipeline.
- Do not delete production data unless explicitly authorized.

## UI checklist
1. Open public URL.
2. Confirm login/signup screen assets load.
3. Login or create temporary smoke account safely.
4. Confirm dashboard loads.
5. Confirm sidebar and header/session indicator.
6. Open Proyectos.
7. Confirm episodes/cards visible.
8. Open Workspace from heading or Editar Workspace.
9. Confirm breadcrumb, title, status, and Volver a Proyectos.
10. Create episode only if Work Order authorizes it.
11. Change stage only if Work Order authorizes it.
12. Check console for critical errors.
13. Confirm assets/network do not show auth failures.

## API companion checks
- `/api/health` public 200.
- `/api/episodes` with auth 200 if scoped.
- `/api/episodes/:id` with auth 200 if scoped.

## Delivery format
Status, URL, login yes/no, dashboard/sidebar/header/projects/workspace markers, created/changed entities, console errors, API smoke, prohibited actions confirmation, next recommendation.
