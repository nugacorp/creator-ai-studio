#!/usr/bin/env node
/**
 * Assign user_id to legacy filesystem episodes (no owner).
 * Usage: OWNER_USER_ID=<uuid> LOCAL_STORAGE_PATH=/data/episodes node scripts/assign-episode-owner.mjs
 */
import { readdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const ownerId = process.env.OWNER_USER_ID;
const base = path.resolve(process.env.LOCAL_STORAGE_PATH ?? 'episodes');

if (!ownerId) {
  console.error('Set OWNER_USER_ID to the Supabase auth user UUID');
  process.exit(1);
}

async function main() {
  const entries = await readdir(base, { withFileTypes: true });
  let updated = 0;
  for (const entry of entries) {
    if (!entry.isDirectory()) continue;
    const episodeFile = path.join(base, entry.name, 'episode.json');
    if (!existsSync(episodeFile)) continue;
    const summary = JSON.parse(await readFile(episodeFile, 'utf8'));
    if (summary.userId) continue;
    summary.userId = ownerId;
    await writeFile(episodeFile, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
    updated += 1;
    console.log('Assigned', summary.id, summary.title);
  }
  console.log(`Updated ${updated} episodes with user_id=${ownerId}`);
}

void main();
