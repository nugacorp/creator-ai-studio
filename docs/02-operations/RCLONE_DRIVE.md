# Google Drive archive (rclone)

Creator AI Studio keeps active episode workspaces on the VPS volume (`/data/episodes`). When the count exceeds **maxActiveEpisodes** (Settings → Producción), the API can move **published** episodes to Google Drive and delete the local copy.

## Recommended `RCLONE_REMOTE`

```bash
RCLONE_REMOTE=gdrive:Creator-AI-Studio/episodes
RCLONE_CONFIG=/config/rclone/rclone.conf
```

- `gdrive` — name of the rclone remote (you choose this during `rclone config`)
- `Creator-AI-Studio/episodes` — folder path inside that Google account

Staging and production use separate VPS volumes; use the same Drive folder or different subfolders per environment.

## One-time VPS setup (interactive OAuth)

SSH to the VPS and run:

```bash
bash /root/creator-ai-studio/scripts/vps-setup-rclone.sh
```

This script:

1. Runs `rclone config` (choose **Google Drive**, name the remote `gdrive`)
2. Stores credentials in the Docker volume `creator-ai-studio-rclone-config`
3. Creates the `Creator-AI-Studio/episodes` folder on Drive
4. Writes `RCLONE_REMOTE` into `/root/creator-ai-studio/.env.supabase.local`

OAuth requires a browser. On a headless VPS, use `rclone authorize drive` from your laptop and paste the token when prompted.

### Service account (optional)

For unattended servers, configure a Google service account with Drive access and add it in `rclone.conf` instead of OAuth. See [rclone Google Drive docs](https://rclone.org/drive/).

## CI / GitHub Actions

1. Complete the one-time `rclone config` on the VPS (credentials persist in the volume).
2. Add repository secret **`RCLONE_REMOTE`** = `gdrive:Creator-AI-Studio/episodes`
3. Push to `staging` — deploy workflow syncs the value via `scripts/vps-sync-supabase-env.sh` and injects it into the API container.

Do **not** commit `rclone.conf` or OAuth tokens to git.

## How archiving works

| Trigger | Behavior |
|---------|----------|
| **Auto (over limit)** | When `activeEpisodeCount > maxActiveEpisodes`, oldest **published** episodes without active jobs are archived (5 min cooldown on storage polls). |
| **Confirm publish** | If `autoArchiveOnPublish` is enabled in Settings, queues an `archive` job after publish confirmation. |
| **Manual** | Workspace → Producción automática → **Archivar a Drive**, or `POST /api/episodes/:id/archive`. |
| **Deploy** | `scripts/vps-archive-if-over-limit.sh` runs after redeploy when `CAS_API_KEY` and `RCLONE_REMOTE` are set. |

Episodes in `scripting` / `rendering` or with pending pipeline jobs are **never** auto-archived.

## Verify

```bash
# Inside API container
docker exec -it $(docker ps -q -f name=api-z7b1ieqp66a7e43cywaz816w | head -1) \
  rclone lsd gdrive:Creator-AI-Studio/episodes

# Dashboard
curl -s -H "Authorization: Bearer $CAS_API_KEY" \
  https://creator-ai-studio.217.76.56.66.sslip.io/api/system/storage | jq .
```

`archiveConfigured: true` means `RCLONE_REMOTE` is set. The UI shows **Drive: conectado**.

## Restore

`POST /api/episodes/:id/restore` copies the workspace back from Drive if there is room under `maxActiveEpisodes`.

## Troubleshooting

| Symptom | Fix |
|---------|-----|
| `Drive: configura RCLONE_REMOTE` | Set env on API container; redeploy. |
| `4/3` not dropping | Episodes may not be `published` yet, or have active jobs. Publish + confirm, or use manual archive. |
| `rclone` auth errors | Re-run `vps-setup-rclone.sh` or refresh OAuth token. |
| Archive slow / timeout | Large video files; archive runs with 30 min timeout per episode. |
