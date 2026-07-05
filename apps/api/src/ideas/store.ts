import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { CreateIdeaInput, EpisodeIdea } from '@creator-ai-studio/shared';
import { resolveStoragePath } from '../storage/index.js';

interface IdeasFile {
  ideas: EpisodeIdea[];
}

function ideasPath(): string {
  return path.join(resolveStoragePath(), 'ideas.json');
}

async function readIdeasFile(): Promise<IdeasFile> {
  const file = ideasPath();
  if (!existsSync(file)) {
    return { ideas: [] };
  }
  const raw = await readFile(file, 'utf8');
  const parsed = JSON.parse(raw) as IdeasFile;
  return { ideas: parsed.ideas ?? [] };
}

async function writeIdeasFile(data: IdeasFile): Promise<void> {
  const file = ideasPath();
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, `${JSON.stringify(data, null, 2)}\n`, 'utf8');
  const { rename } = await import('node:fs/promises');
  await rename(tmp, file);
}

export async function listIdeas(userId?: string, channelId?: string): Promise<EpisodeIdea[]> {
  const { ideas } = await readIdeasFile();
  let filtered = ideas;
  if (userId) {
    filtered = filtered.filter(idea => !idea.userId || idea.userId === userId);
  }
  if (channelId) {
    filtered = filtered.filter(idea => idea.channelId === channelId);
  }
  return filtered;
}

export async function getIdea(id: string): Promise<EpisodeIdea | null> {
  const { ideas } = await readIdeasFile();
  return ideas.find(idea => idea.id === id) ?? null;
}

export async function createIdea(input: CreateIdeaInput, userId?: string): Promise<EpisodeIdea> {
  const now = new Date().toISOString();
  const idea: EpisodeIdea = {
    id: randomUUID(),
    rawIdea: input.rawIdea.trim(),
    audience: input.audience?.trim() || undefined,
    passage: input.passage?.trim() || undefined,
    proposals: [],
    status: 'draft',
    createdAt: now,
    updatedAt: now,
    userId,
    ...(input.channelId ? { channelId: input.channelId } : {}),
  };
  const file = await readIdeasFile();
  file.ideas.unshift(idea);
  await writeIdeasFile(file);
  return idea;
}

export async function saveIdea(idea: EpisodeIdea): Promise<EpisodeIdea> {
  const file = await readIdeasFile();
  const index = file.ideas.findIndex(entry => entry.id === idea.id);
  if (index < 0) {
    file.ideas.unshift(idea);
  } else {
    file.ideas[index] = { ...idea, updatedAt: new Date().toISOString() };
  }
  await writeIdeasFile(file);
  return file.ideas.find(entry => entry.id === idea.id)!;
}

export async function deleteIdea(id: string): Promise<boolean> {
  const file = await readIdeasFile();
  const before = file.ideas.length;
  file.ideas = file.ideas.filter(idea => idea.id !== id);
  if (file.ideas.length === before) return false;
  await writeIdeasFile(file);
  return true;
}
