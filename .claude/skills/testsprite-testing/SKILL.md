---
name: testsprite-testing
description: Run AI-driven advanced end-to-end tests with video recording via TestSprite (MCP server). Use when asked to auto-generate and execute a full test suite for the app, get recorded video/reproduction of a flow, or run TestSprite. Requires a TESTSPRITE_API_KEY and the testsprite MCP server enabled.
---

# TestSprite — AI test generation with video recording

TestSprite runs as an **MCP server** (not a plain CLI). It plans, generates and
executes end-to-end tests against a running app and returns a report with
recorded video of each flow.

## Prerequisites
1. Create an account and API key at https://www.testsprite.com (Dashboard → API Keys).
2. Provide the key to Claude Code as the `TESTSPRITE_API_KEY` environment variable
   (referenced by [.mcp.json](../../../.mcp.json)). Do **not** commit the key.
3. Restart Claude Code so it picks up the `testsprite` MCP server, then approve it.

```bash
# make the key available before launching claude in this repo
export TESTSPRITE_API_KEY=ts-...        # PowerShell: $env:TESTSPRITE_API_KEY = 'ts-...'
```

The server itself is fetched on demand via `npx -y @testsprite/testsprite-mcp@latest`
(configured in `.mcp.json`) — no global install needed.

## Usage
Once the MCP server is connected, drive it through its exposed MCP tools
(bootstrap the tests, then generate and run the plan). Point it at a **running**
target:

- Local: start `npm run dev --workspace @creator-ai-studio/web` (:5173), or pair
  with the [cloudflare-tunnel](../cloudflare-tunnel/SKILL.md) skill to give
  TestSprite a public HTTPS URL.
- Staging: `https://creator-ai-studio.217.76.56.66.sslip.io`.

Ask for what you want ("generate and run an e2e suite for the episode workspace
flow and record video") and let the MCP tools plan → generate → execute → report.

## Guardrails
- Never point TestSprite at a target wired to real YouTube/AI credentials; use a
  demo/staging environment so generated tests can't publish or spend real quota.
- Keep `TESTSPRITE_API_KEY` in the environment only — never in the repo, specs,
  or PR/issue text.
- If the `testsprite` MCP server isn't listed as available, it isn't configured
  yet — tell the user to set the key and restart, rather than guessing.
