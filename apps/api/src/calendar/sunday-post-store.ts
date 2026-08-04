import { existsSync } from 'node:fs';
import { mkdir, readFile, rename, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { SundayServicePostResult } from './sunday-post.js';
import { resolveDataPath } from '../storage/index.js';

export interface SundayServicePostArtifact {
  channelId: string;
  generatedAt: string;
  fridayDate: string;
  imageUrl: string;
  prompt: string;
  isFallback: boolean;
  fallbackReason?: string;
  post: SundayServicePostResult;
}

export interface SundayServicePostTemplate {
  serviceTopic?: string;
  visualDirection?: string;
  promptOverride?: string;
  updatedAt: string;
}

interface SundayServicePostStore {
  artifactsByChannel: Record<string, SundayServicePostArtifact>;
  templatesByChannel: Record<string, SundayServicePostTemplate>;
}

const DEFAULT_STORE: SundayServicePostStore = {
  artifactsByChannel: {},
  templatesByChannel: {},
};

function storePath(): string {
  return path.join(resolveDataPath(), 'calendar', 'sunday-service-posts.json');
}

async function readStore(): Promise<SundayServicePostStore> {
  const file = storePath();
  if (!existsSync(file)) return { ...DEFAULT_STORE };

  try {
    const raw = await readFile(file, 'utf8');
    if (!raw.trim()) return { ...DEFAULT_STORE };
    const parsed = JSON.parse(raw) as SundayServicePostStore;
    return {
      artifactsByChannel: parsed.artifactsByChannel ?? {},
      templatesByChannel: parsed.templatesByChannel ?? {},
    };
  } catch {
    const backup = `${file}.corrupt.${new Date().toISOString().replace(/[:.]/g, '-')}`;
    await rename(file, backup).catch(() => undefined);
    return { ...DEFAULT_STORE };
  }
}

async function writeStore(store: SundayServicePostStore): Promise<void> {
  const file = storePath();
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, `${JSON.stringify(store, null, 2)}\n`, 'utf8');
  await rename(tmp, file);
}

export async function getLatestSundayServicePostArtifact(
  channelId: string,
): Promise<SundayServicePostArtifact | null> {
  const store = await readStore();
  return store.artifactsByChannel[channelId] ?? null;
}

export async function saveSundayServicePostArtifact(
  artifact: SundayServicePostArtifact,
): Promise<SundayServicePostArtifact> {
  const store = await readStore();
  store.artifactsByChannel[artifact.channelId] = artifact;
  await writeStore(store);
  return artifact;
}

export async function getSundayServicePostTemplate(
  channelId: string,
): Promise<SundayServicePostTemplate | null> {
  const store = await readStore();
  return store.templatesByChannel[channelId] ?? null;
}

export async function saveSundayServicePostTemplate(
  channelId: string,
  template: { serviceTopic?: string; visualDirection?: string; promptOverride?: string },
): Promise<SundayServicePostTemplate> {
  const store = await readStore();
  const next: SundayServicePostTemplate = {
    serviceTopic: template.serviceTopic?.trim() || undefined,
    visualDirection: template.visualDirection?.trim() || undefined,
    promptOverride: template.promptOverride?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
  store.templatesByChannel[channelId] = next;
  await writeStore(store);
  return next;
}
