# FASE 2 — TTS Validation (Hermes)

## Prerequisites

- FASE 1 complete (IA provider working)
- ElevenLabs API key configured
- `ttsProvider=elevenlabs` in settings

## Product Owner

- [ ] ElevenLabs account has credits
- [ ] Voice ID selected (Spanish)
- [ ] Voice style confirmed (masculine / feminine / neutral)

## Hermes steps

1. `GET /api/system/mode` → `ttsConfigured: true`
2. Run safe pipeline or TTS job on test episode
3. Verify file exists: `{episode-dir}/05-audio/narration.mp3` (or `.wav`)
4. Confirm file plays and size > 1 KB
5. Confirm response has no `isDemo: true`

```http
POST /api/integrations/elevenlabs/tts
Authorization: Bearer <token>
Content-Type: application/json

{
  "text": "Prueba de narración Creator AI Studio.",
  "episodeId": "<episode-uuid>"
}
```

## Exit criteria

- [ ] Real audio file on disk
- [ ] No demo/mock flag in API response
