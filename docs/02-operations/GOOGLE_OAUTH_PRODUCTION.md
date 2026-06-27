# Google OAuth — Modo Production (tokens de larga duración)

## Por qué importa

Si tu app OAuth en Google Cloud está en **Testing**, los refresh tokens expiran a los **7 días** cuando usas scopes sensibles (Gemini, YouTube, etc.). Creator AI Studio renueva tokens automáticamente, pero tras 7 días Google puede exigir reconectar.

En **In production**, el refresh token no caduca por tiempo (salvo revocación manual o 6 meses sin uso).

## Pasos en Google Cloud Console

1. Abre [OAuth consent screen](https://console.cloud.google.com/apis/credentials/consent).
2. Confirma **User type: External**.
3. En **Publishing status**, pulsa **Publish app** → estado **In production**.
4. No necesitas verificación completa de Google para uso personal o pocas cuentas; pueden seguir apareciendo avisos de “app no verificada”.
5. Añade scopes si faltan:
   - `.../auth/cloud-platform`
   - `.../auth/generative-language.retriever`
   - `.../auth/youtube.upload`
   - `.../auth/youtube.readonly`
   - `.../auth/yt-analytics.readonly`
6. En **Test users**, mantén tu email si la app sigue sin verificar.

## Reconectar en Creator AI Studio

Tras cambiar a **In production**, los tokens emitidos en Testing **no se alargan solos**:

1. Ve a **Configuración** en Creator AI Studio.
2. En Gemini o YouTube, pulsa **Reconectar** (forzará consentimiento una vez).
3. Autoriza en Google (Configuración avanzada → Ir a sslip.io si aparece el aviso).

A partir de ahí la sesión queda guardada cifrada en el servidor (`/data/episodes/.secrets/secrets.enc`).

## Redirect URI

Debe coincidir exactamente con la URL pública:

```
https://creator-ai-studio.217.76.56.66.sslip.io/api/oauth/google/callback
```

(o tu dominio propio si lo cambias en `CAS_PUBLIC_URL`).

## Referencias

- [Gemini OAuth quickstart](https://ai.google.dev/gemini-api/docs/oauth)
- [OAuth token expiration](https://developers.google.com/identity/protocols/oauth2#expiration)
- [HTTPS en Coolify](../deploy/HTTPS_COOLIFY.md)
