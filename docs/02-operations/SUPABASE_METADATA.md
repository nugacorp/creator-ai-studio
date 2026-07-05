# Supabase Metadata (FASE 9 — Option B)

Episode **metadata** (title, status, content JSON, stages) can be read from Supabase Postgres while **media files** remain on `/data/episodes`.

## Configuration

```env
EPISODE_METADATA_SOURCE=filesystem   # default — disk only
EPISODE_METADATA_SOURCE=supabase     # list from Postgres; detail from disk
EPISODE_METADATA_SOURCE=hybrid       # Postgres first, fallback to disk list
SUPABASE_URL=https://YOUR_PROJECT.supabase.co
SUPABASE_SERVICE_ROLE_KEY=...
```

## Architecture

- **Writes:** filesystem + `syncEpisodeToSupabase()` (unchanged)
- **Reads (list):** Supabase when `EPISODE_METADATA_SOURCE` is `supabase` or `hybrid`
- **Reads (detail):** always filesystem (workspace_path from row or episode dir)
- **Media:** never in Supabase Storage — audio/video/thumbnails on VPS volume

## Migration

```bash
# Assign owner to legacy episodes (optional)
OWNER_USER_ID=<uuid> node scripts/assign-episode-owner.mjs

# Upsert all disk episodes to Supabase
SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... \
LOCAL_STORAGE_PATH=/data/episodes \
node scripts/migrate-episodes-to-supabase.mjs
```

## Backup

- Postgres: Supabase dashboard backups / `pg_dump` via pooler
- Media: VPS volume `creator-ai-studio-staging-episodes` + rclone archive (FASE 7)
