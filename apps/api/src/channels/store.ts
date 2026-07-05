import { randomUUID } from 'node:crypto';
import { existsSync } from 'node:fs';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { ChannelRecord, CreateChannelInput } from '@creator-ai-studio/shared';
import { resolveStoragePath } from '../storage/index.js';

const DEFAULT_CHANNELS: ChannelRecord[] = [];

function channelsPath(): string {
  return path.join(resolveStoragePath(), '..', 'channels.json');
}

async function readChannels(): Promise<ChannelRecord[]> {
  const file = channelsPath();
  if (!existsSync(file)) {
    await writeChannels(DEFAULT_CHANNELS);
    return [...DEFAULT_CHANNELS];
  }
  return JSON.parse(await readFile(file, 'utf8')) as ChannelRecord[];
}

async function writeChannels(channels: ChannelRecord[]): Promise<void> {
  const file = channelsPath();
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(file, `${JSON.stringify(channels, null, 2)}\n`, 'utf8');
}

export async function listChannels(): Promise<ChannelRecord[]> {
  return readChannels();
}

export async function createChannel(input: CreateChannelInput): Promise<ChannelRecord> {
  const channels = await readChannels();
  const channel: ChannelRecord = {
    id: randomUUID(),
    name: input.name.trim(),
    type: input.type,
    status: input.status ?? 'Produciendo',
    subscribers: input.subscribers ?? 0,
    avatar: input.avatar ?? '📺',
  };
  channels.push(channel);
  await writeChannels(channels);
  return channel;
}

export async function updateChannel(
  id: string,
  patch: Partial<CreateChannelInput>,
): Promise<ChannelRecord | null> {
  const channels = await readChannels();
  const index = channels.findIndex(c => c.id === id);
  if (index < 0) return null;

  channels[index] = {
    ...channels[index],
    ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
    ...(patch.type !== undefined ? { type: patch.type } : {}),
    ...(patch.status !== undefined ? { status: patch.status } : {}),
    ...(patch.subscribers !== undefined ? { subscribers: patch.subscribers } : {}),
    ...(patch.avatar !== undefined ? { avatar: patch.avatar } : {}),
  };
  await writeChannels(channels);
  return channels[index];
}

export async function deleteChannel(id: string): Promise<boolean> {
  const channels = await readChannels();
  const next = channels.filter(c => c.id !== id);
  if (next.length === channels.length) return false;
  await writeChannels(next);
  return true;
}
