---
name: github-cli
description: Manage this repository from the terminal with the GitHub CLI (gh) — open and merge pull requests, create and triage issues, inspect CI checks and releases. Use when asked to create a PR, open/close an issue, check PR/CI status, review or merge a PR, or otherwise drive nugacorp/creator-ai-studio on GitHub.
---

# GitHub CLI (`gh`) — repo operations for creator-ai-studio

`gh` is installed and authenticated in this environment. Repo:
`nugacorp/creator-ai-studio`.

## Repo conventions (must follow)
- **Never target `main` directly.** `main` is the stable production branch.
  Feature branches → `staging`; promote `staging` → `main` only via an explicit
  release PR when the user asks.
- Branch from `staging`: `git checkout -b feature/<slug> origin/staging`.
- End PR bodies with the Claude Code attribution line.
- Prefer new commits over amending; branch before committing if on `main`/`staging`.

## Pull requests
```bash
# Open a PR to staging
gh pr create --base staging --head feature/<slug> \
  --title "fix: <summary>" --body "<markdown body>"

# Inspect / review
gh pr list --state open --json number,title,headRefName,baseRefName,mergeStateStatus
gh pr view <n> --json number,url,baseRefName,headRefName,state,commits
gh pr diff <n>
gh pr checks <n>            # CI status for the PR

# Merge (merge commit keeps branch history, matching this repo's style)
gh pr merge <n> --merge
```

## Issues
```bash
gh issue create --title "<title>" --body "<body>" --label bug
gh issue list --state open
gh issue view <n>
gh issue close <n>
```

## Handy
```bash
gh run list        # recent GitHub Actions runs
gh run view <id> --log-failed
gh repo view --web
```

## Guardrails
- Do **not** `--force` push, delete remote branches, or merge into `main`
  without explicit user confirmation — these are destructive/outward-facing.
- Don't paste secrets into issue/PR bodies.
- Confirm before merging or closing anything the user didn't clearly authorize.
