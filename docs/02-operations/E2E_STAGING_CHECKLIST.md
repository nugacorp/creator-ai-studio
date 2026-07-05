# FASE 12 — E2E Staging Checklist (Hermes)

Run on https://creator-ai-studio.217.76.56.66.sslip.io after all code phases merged.

## Episode creation

- [ ] Login as production user
- [ ] Create short test episode (< 2 min target)

## Safe pipeline (no YouTube)

- [ ] `POST /episodes/:id/run-safe-pipeline` mode `production-draft`
- [ ] Job completes without YouTube upload

## Artifacts

- [ ] `02-script/script.md` or content.script populated
- [ ] `08-seo/metadata.json` or seo fields in content
- [ ] `05-audio/*.mp3` exists and plays
- [ ] `07-thumbnail/thumbnail.png` exists
- [ ] `06-video/episode.mp4` exists and plays
- [ ] `09-shorts/short.mp4` exists
- [ ] `10-publish/metadata.json` + `checklist.json`

## Safety

- [ ] No YouTube video ID created during draft pipeline
- [ ] `demoMode=false`, no `[Modo Demo]` in outputs
- [ ] Logs contain no API keys or tokens

## Infrastructure

- [ ] Worker processes job without manual intervention
- [ ] Redis connected (BullMQ or poll fallback)
- [ ] Redeploy preserves `/data/episodes` volume

## YouTube (only with PO authorization)

- [ ] OAuth connected in Configuración
- [ ] `POST /episodes/:id/publish-package` → checklist ready
- [ ] Authorized publish → private/unlisted video only
- [ ] PO confirms visibility in YouTube Studio

## Sign-off

| Role | Name | Date | Result |
|------|------|------|--------|
| Hermes | | | |
| PO | | | |
