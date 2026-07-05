---
name: playwright-web-testing
description: Run and debug the web dashboard's end-to-end browser tests with Playwright (apps/web), record traces/screenshots/video on failure, and iterate on UI fixes against a live browser. Use when asked to run e2e tests, reproduce a UI bug in a real browser, verify a frontend change end-to-end, or debug a failing Playwright spec.
---

# Playwright — browser testing for the web dashboard

Playwright is already a dev dependency of the `@creator-ai-studio/web` workspace.
Specs live in [apps/web/e2e/](../../../apps/web/e2e/) and the config is
[apps/web/playwright.config.ts](../../../apps/web/playwright.config.ts)
(`baseURL` defaults to `http://localhost:5173`, the Vite dev port).

## One-time setup
The browser binaries are not installed by default. From the repo root:

```bash
cd apps/web
npx playwright install chromium      # add --with-deps on Linux CI
```

## Run the tests
Playwright's `webServer` auto-starts `npm run dev` **only when `CI` is set**.
Locally you must have the dev server running yourself, or export `CI=1`.

```bash
# Option A: start the dev server in one shell, run specs in another
npm run dev --workspace @creator-ai-studio/web      # serves http://localhost:5173
cd apps/web && npx playwright test

# Option B: let Playwright manage the server
cd apps/web && CI=1 npx playwright test
```

Target a spec or run headed/debug while iterating on a fix:

```bash
cd apps/web
npx playwright test e2e/basic.spec.ts        # single file
npx playwright test --headed --project=chromium
npx playwright test --debug                  # inspector, step through
npx playwright show-report                    # open the HTML report (reporter: 'html')
```

Point the run at deployed staging instead of localhost:

```bash
E2E_BASE_URL=https://creator-ai-studio.217.76.56.66.sslip.io npx playwright test
```

## Debug a failure ("automatic web correction" loop)
1. Reproduce: `npx playwright test <spec> --headed` and read the assertion.
2. Inspect the trace/screenshot from the HTML report to see the real DOM state.
3. Prefer role/text queries (`getByRole`, `getByText`) — they mirror how the
   component tree actually renders (see the vitest specs in `apps/web/test/`).
4. Fix the component in `apps/web/src/`, re-run the spec, repeat until green.
5. Keep new specs deterministic: no real network to third-party AI/YouTube — mock
   at the API boundary or run against seeded staging data only.

## Guardrails
- Never run the production pipeline or publish to YouTube from a test.
- Don't hardcode secrets or real API keys in specs; use env vars.
- Playwright artifacts (`playwright-report/`, `test-results/`) are build output —
  don't commit them.
