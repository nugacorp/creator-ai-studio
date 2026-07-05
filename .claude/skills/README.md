# Agent skills (Claude Code)

Project-level skills that teach Claude Code how and when to use five CLI/MCP
capabilities in this repo. Each lives in its own folder with a `SKILL.md`
(YAML frontmatter `name` + `description`, then instructions). Claude Code loads
them automatically when this repo is open; invoke one explicitly with
`/<skill-name>` or just describe the task and the matching skill triggers.

| Skill | Purpose | Ready? | Needs |
|---|---|---|---|
| [playwright-web-testing](playwright-web-testing/SKILL.md) | E2E browser tests + debug/fix loop for the dashboard | ✅ in-repo | `npx playwright install chromium` (browser binaries) |
| [github-cli](github-cli/SKILL.md) | PRs, issues, CI status from the terminal | ✅ `gh` installed & authed | — |
| [cloudflare-tunnel](cloudflare-tunnel/SKILL.md) | Public HTTPS URL for localhost | ⚙️ install | `winget install Cloudflare.cloudflared` |
| [testsprite-testing](testsprite-testing/SKILL.md) | AI-generated e2e tests with video (MCP) | ⚙️ key | `TESTSPRITE_API_KEY` + restart Claude Code |
| [context7-docs](context7-docs/SKILL.md) | Inject current library docs (MCP) | ⚙️ enable | approve MCP; optional `CONTEXT7_API_KEY` |

## MCP servers
Context7 and TestSprite run as MCP servers, configured in
[`.mcp.json`](../../.mcp.json) (fetched on demand via `npx`, no global install).
After cloning, Claude Code will ask to approve these servers on first use.

- **Context7** works keyless (lower rate limits); set `CONTEXT7_API_KEY` for more.
- **TestSprite** requires `TESTSPRITE_API_KEY` from https://www.testsprite.com.
- Export the keys in your shell **before** launching `claude` in this repo. Never
  commit them.
- Windows note: if an MCP server fails to spawn via `npx`, change its `command`
  in `.mcp.json` to `cmd` with args `["/c", "npx", "-y", "<package>"]`.

## Setup checklist
```bash
# Playwright browsers
cd apps/web && npx playwright install chromium && cd ../..

# Cloudflare tunnel binary
winget install --id Cloudflare.cloudflared   # or: npm i -g cloudflared

# MCP API keys (this shell session), then relaunch Claude Code
export TESTSPRITE_API_KEY=ts-...
export CONTEXT7_API_KEY=ctx7-...             # optional
```
