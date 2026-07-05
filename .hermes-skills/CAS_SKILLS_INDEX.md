# Creator AI Studio — Hermes Skills Index

Created: 2026-07-04T23:02:33-07:00
Profile: default
Project: Creator AI Studio
Repository: nugacorp/creator-ai-studio
Staging URL: https://creator-ai-studio.217.76.56.66.sslip.io

## Purpose

Local index for skills Hermes should use when developing, validating, deploying, and operating Creator AI Studio through real production readiness.

## Hub / official skills installed during CAS-HERMES-OPS-0047

- `docker-management` — official/devops/docker-management. Use for Docker/Docker Compose service, image, volume, and container operations.
- `rest-graphql-debug` — official/software-development/rest-graphql-debug. Use for API debugging, REST smoke tests, auth status checks, and endpoint repros.
- `web-pentest` — official/security/web-pentest. Use only for authorized security testing; active scanning requires explicit written scope/authorization.
- `code-wiki` — official/software-development/code-wiki. Use for repo architecture/reference documentation outside the repo unless user authorizes repo doc writes.
- `adversarial-ux-test` — official/dogfood/adversarial-ux-test. Use for UX friction testing of staging UI when authorized.
- `playwright` — skills-sh/openai/skills/playwright, trusted source. Use for Playwright CLI browser automation when the built-in browser tool is insufficient.

## Relevant bundled skills already available

- `github-pr-workflow` — PR validation, staging merges, CI/deploy discipline.
- `github-repo-management` — clone/fork/remotes/releases.
- `github-auth` — GitHub credentials/SSH/token setup.
- `github-code-review` — PR/code reviews.
- `github-issues` — GitHub issue management.
- `plan` — implementation planning.
- `test-driven-development` — TDD workflow.
- `systematic-debugging` — root-cause debugging.
- `requesting-code-review` — pre-commit review and quality gates.
- `dogfood` — exploratory QA of web apps.
- `google-workspace` — Google APIs/Drive/Docs/Sheets workflows.
- `youtube-content` — YouTube content/transcript workflows; not a publish safety skill.
- `ocr-and-documents` — document extraction.
- `architecture-diagram` / `excalidraw` — architecture diagrams.
- `humanizer` — prose editing.
- `codebase-inspection` — LOC/language/codebase inspection.
- `hermes-agent` — configure/use Hermes itself.
- `hermes-agent-skill-authoring` — skill authoring conventions.

## Local CAS skills created during CAS-HERMES-OPS-0047

- `cas-production-readiness` — production readiness checklist: no mocks, real providers, real TTS/render, YouTube/Drive/domain/rollback gates.
- `cas-hermes-deploy-coolify` — safe staging deploy via Coolify/VPS scripts and post-deploy verification.
- `cas-ai-provider-validation` — OpenAI/Claude/Gemini real provider validation without printing secrets or running pipeline.
- `cas-e2e-safe-pipeline` — safe E2E through publish package only; no YouTube publish.
- `cas-security-validation` — auth, fail-closed routes, OAuth safety, path traversal, rate limit, log/secret hygiene.
- `cas-ui-smoke-test` — public UI login/dashboard/projects/workspace smoke without AI/pipeline.
- `cas-worker-redis-ops` — worker/Redis/job queue operations without double execution or publish.
- `cas-youtube-release-safety` — YouTube upload/publish safety gate with explicit human authorization.
- `cas-supabase-auth-ops` — Supabase/Auth/JWT/settings validation without token disclosure.
- `cas-runbook-author` — operational documentation/runbook/changelog updates without secrets.

## Which skill to use by task

- Validate PR / merge staging / GitHub state: `github-pr-workflow` plus CAS-specific skill if relevant.
- Deploy staging via Coolify: `cas-hermes-deploy-coolify`, optionally `docker-management`.
- Validate production readiness: `cas-production-readiness`.
- Validate AI providers: `cas-ai-provider-validation`.
- Run safe E2E pipeline: `cas-e2e-safe-pipeline`.
- Validate security hardening: `cas-security-validation`; use `web-pentest` only with explicit authorized active-test scope.
- Smoke public UI: `cas-ui-smoke-test`, optionally `dogfood`, `adversarial-ux-test`, or `playwright`.
- Operate worker/Redis/jobs: `cas-worker-redis-ops`, optionally `docker-management`.
- YouTube release or publish: `cas-youtube-release-safety`.
- Supabase/Auth: `cas-supabase-auth-ops`, optionally `rest-graphql-debug`.
- Runbooks/docs: `cas-runbook-author`, optionally `code-wiki` or `project-document-control`.
- Debug API endpoint/auth failure: `rest-graphql-debug` plus `cas-security-validation` or `cas-supabase-auth-ops`.
- Codebase inspection: `codebase-inspection`.

## Global CAS safety reminders

- Do not print secrets, tokens, CAS_API_KEY, API keys, cookies, service_role keys, or Authorization headers.
- Do not touch `main` unless explicitly authorized.
- Do not modify Creator AI Studio repo during skills-preparation work orders.
- Do not deploy, change variables, run pipeline, TTS, render, shorts, publish, or confirm-publish unless explicitly authorized by a Work Order.
- Do not use mocks/demo fallback for production gates.
- Stop on merge conflicts or unauthorized production-side effects.

## Risks / pending

- `web-pentest`, `docker-management`, and `rest-graphql-debug` triggered Hermes security-scan dangerous warnings because they document powerful commands/patterns. They were installed only because they are official optional skills; active use still requires scope and safety review.
- `playwright` is trusted, not official. It was inspected before installation and installed because it comes from OpenAI's skills repo via skills.sh trusted source.
- No dedicated official Coolify, Supabase, Fastify, Vite, Tailwind, BullMQ, or YouTube-publish skill was installed from Hub; use local CAS skills plus bundled/google/github/docker/API skills.
- Skill changes may require a new Hermes session or `/reset` for automatic skill discovery in some contexts.
