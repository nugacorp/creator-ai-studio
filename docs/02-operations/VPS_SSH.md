# VPS SSH access (cas-core-01)

Creator AI Studio staging/production runs on **cas-core-01** (`217.76.56.66`). Root login is **public-key only** (`PermitRootLogin prohibit-password`; effective `PasswordAuthentication no` via cloud-init overrides).

## Keys that work

| Key file | Identity | On VPS `authorized_keys` |
|----------|----------|---------------------------|
| `%USERPROFILE%\.ssh\cursor_creator_studio` | `cursor-creator-ai-studio` | Yes |
| GitHub Actions `VPS_SSH_KEY` | (deploy key in CI) | Typically the `coolify-local` ed25519 line |

These **do not** work for `root@217.76.56.66`:

- `%USERPROFILE%\.ssh\id_ed25519` (personal key not installed for root)
- `creator@` user (not configured on this host)

## Command for Cursor / agents (Windows)

Use the dedicated private key and a known-hosts file if the default `known_hosts` is broken (see below):

```powershell
ssh -i "$env:USERPROFILE\.ssh\cursor_creator_studio" `
  -o UserKnownHostsFile=C:\Temp\known_hosts_cas `
  -o BatchMode=yes `
  root@217.76.56.66
```

Helper script (repo):

```powershell
.\scripts\ssh-cas-vps.ps1
.\scripts\ssh-cas-vps.ps1 -Command "hostname; docker ps --format '{{.Names}}'"
```

After repairing `%USERPROFILE%\.ssh\known_hosts`, you can omit `UserKnownHostsFile`:

```powershell
ssh -i "$env:USERPROFILE\.ssh\cursor_creator_studio" -o BatchMode=yes root@217.76.56.66
```

## Fix `known_hosts` on Windows

1. **Invalid line** — If `ssh-keygen -R 217.76.56.66` reports `invalid line`, open `%USERPROFILE%\.ssh\known_hosts` and remove orphan lines (bare base64 without a `host algo` prefix). A backup was saved as `known_hosts.bak-*` when repaired locally.
2. **Stale host key** — Run `ssh-keygen -R 217.76.56.66 -f $env:USERPROFILE\.ssh\known_hosts`, then connect once with `-o StrictHostKeyChecking=accept-new` (or use `C:\Temp\known_hosts_cas` as above).
3. **`ssh-keyscan` on Windows** — OpenSSH `ssh-keyscan` may fail with `choose_kex: unsupported KEX method sntrup761x25519-sha512@openssh.com`. Prefer `StrictHostKeyChecking=accept-new` on first connect instead of `ssh-keyscan`.

## Add a new deploy key

1. Generate: `ssh-keygen -t ed25519 -f $env:USERPROFILE\.ssh\cursor_cas_deploy_ed25519 -C "cursor-cas-deploy" -N '""'`
2. Append the `.pub` to `/root/.ssh/authorized_keys` using an existing working key (or update GitHub secret `VPS_SSH_KEY` and redeploy).

## Hermes Agent CLI vs CAS deploy tree

Two directories on cas-core-01 — do not conflate them:

| Path | Use |
|------|-----|
| `/home/creator/projects/creator-ai-studio` | Hermes Agent **git workspace** (`creator` user, full `.git`) |
| `/root/creator-ai-studio` | **CI rsync deploy target** (no `.git`; run `vps-redeploy.sh` as root) |

Hermes Agent CLI walks parent directories for `.git` when building its system prompt. If `/root/creator-ai-studio/.git` exists (e.g. after a manual `git init` as root) and is unreadable to the running user, Hermes aborts with:

`PermissionError: [Errno 13] Permission denied: '/root/creator-ai-studio/.git'`

Fix: use `/home/creator/projects/creator-ai-studio` as Hermes cwd; CI runs `scripts/vps-post-rsync.sh` after each rsync to delete stray `.git` under `/root/creator-ai-studio` and restore `+x` on deploy scripts.

## Related

- Google Drive / rclone: [RCLONE_DRIVE.md](./RCLONE_DRIVE.md)
- Apply OAuth token on VPS: `scripts/vps-apply-rclone-token.sh` (requires GitHub secret `RCLONE_OAUTH_TOKEN_JSON`)
