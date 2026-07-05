---
name: cas-e2e-safe-pipeline
description: "Run Creator AI Studio safe E2E production-draft pipeline through publish package, never YouTube publish."
version: 1.0.0
author: Hermes Agent
license: MIT
metadata:
  hermes:
    tags: [creator-ai-studio, e2e, pipeline, safe, no-publish]
---

# CAS E2E Safe Pipeline

Use only when a Work Order explicitly authorizes safe E2E pipeline validation.

## Inputs needed
- Environment URL and expected commit.
- Test episode title/theme.
- Confirmation that publish is not authorized.

## Safety rules
- Never print secrets/tokens/Authorization headers.
- Do not publish to YouTube.
- Do not call `publish`, `confirm-publish`, or authorized upload endpoints.
- Use private/non-final test content only.
- Stop before YouTube publish.

## Allowed operations when explicitly scoped
1. Create or select a test episode.
2. Generate real script.
3. Generate SEO.
4. Generate TTS/narration.
5. Generate thumbnail.
6. Render video.
7. Generate shorts.
8. Create publish package.
9. Validate artefacts under episode workspace, e.g. `/data/episodes` on VPS.

## Prohibited operations
- YouTube upload/publish.
- Confirm publish.
- Public release.
- Reusing final production content unless authorized.

## Checklist
1. Confirm production-draft or ready-for-review mode only.
2. Confirm demo/mocks disabled if production-readiness validation.
3. Confirm services api/web/worker/redis are up.
4. Enqueue/execute only scoped jobs.
5. Validate job completion and artefact paths.
6. Validate publish package metadata/checklist.
7. Confirm YouTube was not called.

## Delivery format
Status, episode ID, jobs run, artefacts created, publish package result, blocked steps, confirmation that YouTube publish did not run, next recommendation.
