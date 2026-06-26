# HTTPS en staging (Coolify + sslip.io)

## Síntoma

- `http://creator-ai-studio.217.76.56.66.sslip.io` → **funciona**
- `https://creator-ai-studio.217.76.56.66.sslip.io` → **503 no available server**

Eso significa que Traefik escucha en 443 pero **aún no tiene SSL/router HTTPS** enlazado al contenedor `web`.

## Pasos en Coolify (obligatorio)

1. Abre **Coolify** → tu servidor → aplicación **Creator AI Studio**.
2. Ve a **Configuration** → **Domains** (o **General** → FQDN).
3. Dominio: `creator-ai-studio.217.76.56.66.sslip.io`
4. Activa **HTTPS** / **Generate SSL** (Let's Encrypt).
5. Activa **Redirect HTTP → HTTPS** (recomendado).
6. Puerto del servicio **web**: `8080` (no 80 ni 3000).
7. En **Environment variables** del stack, añade o confirma:
   ```
   CAS_PUBLIC_URL=https://creator-ai-studio.217.76.56.66.sslip.io
   ```
8. Pulsa **Redeploy** y espera 2–5 minutos (emisión del certificado).

## Verificación

```bash
curl -I https://creator-ai-studio.217.76.56.66.sslip.io/api/health
```

Debe devolver **HTTP/2 200** (o HTTP/1.1 200) con cabecera `Server: nginx`.

## Google OAuth (producción)

Con HTTPS activo, en Google Cloud Console usa **solo `https://`**:

| Campo | Valor |
|--------|--------|
| Origen JavaScript | `https://creator-ai-studio.217.76.56.66.sslip.io` |
| Redirect URI | `https://creator-ai-studio.217.76.56.66.sslip.io/api/oauth/google/callback` |

## Si HTTPS sigue en 503

En el VPS por SSH:

```bash
docker logs coolify-proxy --tail 50
```

Si ves `client version 1.24 is too old` → actualiza Traefik en Coolify a **v3.6.1+** (ver [Coolify docs](https://coolify.io/docs/troubleshoot/applications/no-available-server)).

## Puertos del firewall

Deben estar abiertos **80** y **443** en el VPS (Let's Encrypt usa el puerto 80 para el desafío HTTP-01).
