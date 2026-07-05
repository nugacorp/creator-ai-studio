import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { resolveDataPath } from '../storage/index.js';
import type { CopilotMessage, CopilotSession } from './types.js';

const MAX_MESSAGES = 100;

function sessionKey(userId: string, channelId?: string): string {
  const safeUser = userId.replace(/[^a-zA-Z0-9_-]/g, '_');
  const safeChannel = (channelId ?? 'all').replace(/[^a-zA-Z0-9_-]/g, '_');
  return `${safeUser}_${safeChannel}.json`;
}

function sessionPath(userId: string, channelId?: string): string {
  return path.join(resolveDataPath(), 'copilot', sessionKey(userId, channelId));
}

async function readSession(userId: string, channelId?: string): Promise<CopilotSession> {
  const file = sessionPath(userId, channelId);
  if (!existsSync(file)) {
    return {
      userId,
      channelId,
      messages: [],
      updatedAt: new Date().toISOString(),
    };
  }
  const raw = JSON.parse(await readFile(file, 'utf8')) as CopilotSession;
  return {
    userId,
    channelId,
    messages: Array.isArray(raw.messages) ? raw.messages : [],
    updatedAt: raw.updatedAt ?? new Date().toISOString(),
  };
}

async function writeSession(session: CopilotSession): Promise<void> {
  const file = sessionPath(session.userId, session.channelId);
  await mkdir(path.dirname(file), { recursive: true });
  const tmp = `${file}.tmp`;
  await writeFile(tmp, `${JSON.stringify(session, null, 2)}\n`, 'utf8');
  const { rename } = await import('node:fs/promises');
  await rename(tmp, file);
}

export function resolveCopilotUserId(userId?: string): string {
  return userId?.trim() || 'local-dev';
}

export async function getCopilotMessages(
  userId: string,
  channelId?: string,
): Promise<CopilotMessage[]> {
  const session = await readSession(userId, channelId);
  return session.messages;
}

export async function appendCopilotMessages(
  userId: string,
  channelId: string | undefined,
  newMessages: CopilotMessage[],
): Promise<CopilotMessage[]> {
  const session = await readSession(userId, channelId);
  session.messages = [...session.messages, ...newMessages].slice(-MAX_MESSAGES);
  session.updatedAt = new Date().toISOString();
  await writeSession(session);
  return session.messages;
}

export async function replaceCopilotMessages(
  userId: string,
  channelId: string | undefined,
  messages: CopilotMessage[],
): Promise<CopilotMessage[]> {
  const session = await readSession(userId, channelId);
  session.messages = messages.slice(-MAX_MESSAGES);
  session.updatedAt = new Date().toISOString();
  await writeSession(session);
  return session.messages;
}

export function createCopilotMessage(
  role: 'user' | 'assistant',
  content: string,
  extras?: Partial<Omit<CopilotMessage, 'id' | 'role' | 'content' | 'createdAt'>>,
): CopilotMessage {
  return {
    id: randomUUID(),
    role,
    content,
    createdAt: new Date().toISOString(),
    ...extras,
  };
}
