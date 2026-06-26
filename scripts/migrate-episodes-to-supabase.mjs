#!/usr/bin/env node
/**
 * One-shot migration: upsert all filesystem episodes into Supabase when configured.
 * Usage: SUPABASE_URL=... SUPABASE_SERVICE_ROLE_KEY=... LOCAL_STORAGE_PATH=./episodes node scripts/migrate-episodes-to-supabase.mjs
 */
import { readdir, readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const base = path.resolve(process.env.LOCAL_STORAGE_PATH ?? 'episodes');
const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !key) {
  console.error('Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

async function main() {
  const entries = await readdir(base, { withFileTypes: true });
  let count = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const episodeFile = path.join(base, entry.name, 'episode.json');
    if (!existsSync(episodeFile)) continue;
    const summary = JSON.parse(await readFile(episodeFile, 'utf8'));
    const contentFile = path.join(base, entry.name, '00-control', 'content.json');
    const stagesFile = path.join(base, entry.name, '00-control', 'stages.json');
    const content = existsSync(contentFile)
      ? JSON.parse(await readFile(contentFile, 'utf8'))
      : {};
    const stages = existsSync(stagesFile) ? JSON.parse(await readFile(stagesFile, 'utf8')) : [];

    const res = await fetch(`${url}/rest/v1/episodes`, {
      method: 'POST',
      headers: {
        apikey: key,
        Authorization: `Bearer ${key}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=merge-duplicates',
      },
      body: JSON.stringify({
        id: summary.id,
        slug: summary.slug,
        title: summary.title,
        status: summary.status,
        workspace_path: entry.name,
        content,
        stages,
        created_at: summary.createdAt,
        updated_at: summary.updatedAt,
      }),
    });
    if (res.ok) count += 1;
    else console.warn('Failed', summary.id, await res.text());
  }
  console.log(`Migrated ${count} episodes to Supabase`);
}

void main();
