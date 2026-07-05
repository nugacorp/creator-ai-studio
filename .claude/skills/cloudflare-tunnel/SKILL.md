---
name: cloudflare-tunnel
description: Expose a local dev server (the web dashboard on :5173 or the API on :3000) to a temporary public HTTPS URL using Cloudflare Tunnel (cloudflared). Use when asked to share localhost, get a public URL for the running app, test webhooks/OAuth callbacks against local, or demo the dashboard without deploying.
---

# Cloudflare Tunnel (`cloudflared`) — public URL for localhost

Creates an on-demand `https://<random>.trycloudflare.com` URL that forwards to a
local port. No Cloudflare account is needed for these "quick tunnels".

## Install (one-time)
`cloudflared` is not installed by default. On Windows:

```bash
winget install --id Cloudflare.cloudflared
# or: npm i -g cloudflared   (npm wrapper that downloads the binary)
# or download from https://github.com/cloudflare/cloudflared/releases
cloudflared --version
```

## Expose a running dev server
Start the app first, then in another shell open the tunnel:

```bash
# Web dashboard (Vite dev server)
npm run dev --workspace @creator-ai-studio/web        # http://localhost:5173
cloudflared tunnel --url http://localhost:5173

# API (Fastify)
npm run dev --workspace @creator-ai-studio/api        # http://localhost:3000
cloudflared tunnel --url http://localhost:3000
```

`cloudflared` prints the public URL (`https://<something>.trycloudflare.com`).
The tunnel lives only while the command runs; Ctrl-C tears it down.

## Notes for this project
- The Vite dev server may reject unknown Hosts. If the tunneled page fails to
  load, add the tunnel host to `server.allowedHosts` in
  [apps/web/vite.config.ts](../../../apps/web/vite.config.ts) (dev only), or set
  `server.host` appropriately.
- Useful for testing the Google OAuth callback / YouTube flow against a real
  HTTPS origin — set `CAS_PUBLIC_URL` to the tunnel URL for that session.

## Guardrails
- A quick tunnel is **public** — anyone with the URL can reach your localhost.
  Don't expose an app wired to real secrets/credentials; use demo/staging keys.
- Treat the URL as sensitive; share deliberately and stop the tunnel when done.
- For anything durable, use the real staging deploy, not a quick tunnel.
