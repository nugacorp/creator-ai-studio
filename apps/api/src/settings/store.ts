import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { AppSettings } from '@creator-ai-studio/shared';
import { DEFAULT_PUBLISH_SCHEDULE } from '@creator-ai-studio/shared';
import { resolveStoragePath } from '../storage/index.js';

const DEFAULT_SETTINGS: AppSettings = {
  ttsSampleRate: '24000',
  ttsAccent: 'es-ES',
  aiProviderDefault: 'gemini',
  ttsProvider: 'elevenlabs',
  autoArchiveOnPublish: false,
  maxActiveEpisodes: 1,
  diskWarningThresholdGb: 5,
  publishSchedule: DEFAULT_PUBLISH_SCHEDULE,
};

function settingsPath(): string {
  return path.join(resolveStoragePath(), 'settings.json');
}

export async function getSettings(): Promise<AppSettings> {
  const file = settingsPath();
  if (!existsSync(file)) {
    return { ...DEFAULT_SETTINGS };
  }
  const raw = await readFile(file, 'utf8');
  return { ...DEFAULT_SETTINGS, ...(JSON.parse(raw) as AppSettings) };
}

export async function saveSettings(patch: Partial<AppSettings>): Promise<AppSettings> {
  const current = await getSettings();
  const merged = { ...current, ...patch };
  const file = settingsPath();
  await mkdir(path.dirname(file), { recursive: true });
  // Atomic write so a crash mid-write never corrupts settings.json.
  const tmp = `${file}.tmp`;
  await writeFile(tmp, `${JSON.stringify(merged, null, 2)}\n`, 'utf8');
  const { rename } = await import('node:fs/promises');
  await rename(tmp, file);
  return merged;
}
