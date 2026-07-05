---
name: context7-docs
description: Fetch up-to-date, version-accurate documentation and code examples for a library or framework via Context7 (MCP server) and use it before writing integration code. Use when working with an external library (Fastify, React, Vite, Supabase, BullMQ, Playwright, the Anthropic SDK, etc.) and you need current API docs instead of relying on memory, or when the user says "use context7" / "get the latest docs for X".
---

# Context7 — current docs injected into context

Context7 (by Upstash) is an **MCP server** that resolves a library name to its
live documentation and returns focused, version-correct snippets. Use it to avoid
stale or hallucinated APIs when integrating a dependency.

## Prerequisites
Configured in [.mcp.json](../../../.mcp.json) and fetched on demand via
`npx -y @upstash/context7-mcp` — no global install. It works **without** an API
key (lower rate limits); for higher limits create a key at https://context7.com
and expose it as `CONTEXT7_API_KEY`. Restart Claude Code and approve the
`context7` MCP server after configuring.

## When to reach for it
Before writing or debugging code against a moving target, especially the ones
this repo depends on:
- `fastify`, `@fastify/*` — API routes, hooks, schema validation
- `react`, `vite`, `@vitejs/plugin-react`, `tailwindcss`
- `@supabase/supabase-js` — auth / Postgres sync
- `bullmq` / `ioredis` — the worker queue
- `@playwright/test`, `vitest`
- `@anthropic-ai/*` and other AI provider SDKs

## Usage
Through the MCP tools: first resolve the library id, then request docs for a
topic, e.g. "get Context7 docs for Fastify JSON schema validation on routes" or
"latest BullMQ worker concurrency + graceful shutdown docs". Feed the returned
snippets into the implementation instead of guessing the API surface.

Tip: in a normal prompt you can just say "use context7" and name the library +
topic; the model will call the MCP tools.

## Guardrails
- Prefer Context7 over memory for third-party API details, but still cross-check
  against the versions pinned in this repo's `package.json` files.
- If the `context7` MCP server isn't available, it isn't enabled yet — ask the
  user to restart Claude Code / approve it rather than inventing API details.
- Never send repo secrets to the docs server; queries are library names/topics.
