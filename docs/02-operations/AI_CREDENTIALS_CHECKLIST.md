# FASE 1 — AI Credentials Checklist (PO + Hermes)

## Product Owner

- [ ] Choose primary provider: OpenAI / Claude / Gemini
- [ ] Activate billing / credits on primary account
- [ ] Generate production API key (never paste in chat)
- [ ] Store key in Settings UI or Coolify env
- [ ] Configure secondary fallback provider with balance
- [ ] Set `aiProviderDefault` in Configuración to working provider

## Hermes validation

```bash
# Status
curl -s https://creator-ai-studio.217.76.56.66.sslip.io/api/ai/providers/status \
  -H "Authorization: Bearer $TOKEN" | jq .

# Smoke test (replace provider)
curl -s -X POST https://creator-ai-studio.217.76.56.66.sslip.io/api/ai/providers/openai/test \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"operation":"script","prompt":"Responde exactamente: CAS_TEST_OK"}' | jq .

# Generate script
curl -s -X POST https://creator-ai-studio.217.76.56.66.sslip.io/api/ai/generate-script \
  -H "Authorization: Bearer $TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"prompt":"Reflexión corta sobre la fe"}' | jq .
```

## Environment gates

```env
AI_ALLOW_DEMO_FALLBACK=false
ALLOW_MOCKS=false
```

## Exit criteria

- [ ] `GET /api/system/mode` → `demoMode: false`
- [ ] Smoke test returns real text (not `[Modo Demo]`)
- [ ] `POST /api/ai/generate-script` returns non-demo script
