import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';
import { EpisodeStorage } from '../src/storage/index.js';
import { parseToolResponse } from '../src/copilot/handler.js';
import { executeCopilotTool } from '../src/copilot/tools.js';
import { evaluateChatScope } from '../src/ai/chat-scope.js';

describe('copilot persistence', () => {
  let rootDir: string;
  let storageDir: string;
  let app: FastifyInstance;

  beforeEach(async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), 'cas-copilot-'));
    storageDir = path.join(rootDir, 'episodes');
    process.env.LOCAL_STORAGE_PATH = storageDir;
    process.env.AI_ALLOW_DEMO_FALLBACK = 'true';
    app = buildApp({ storage: new EpisodeStorage(storageDir) });
    await app.ready();
  });

  afterEach(async () => {
    delete process.env.LOCAL_STORAGE_PATH;
    delete process.env.AI_ALLOW_DEMO_FALLBACK;
    await app.close();
    await rm(rootDir, { recursive: true, force: true });
  });

  function copilotFile(): string {
    return path.join(rootDir, 'copilot', 'local-dev_all.json');
  }

  it('GET /copilot/messages returns welcome and empty history initially', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/copilot/messages' });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { messages: unknown[]; welcome: string };
    expect(body.messages).toEqual([]);
    expect(body.welcome).toContain('copiloto');
  });

  it('POST /copilot/chat persists messages across GET', async () => {
    const chat = await app.inject({
      method: 'POST',
      url: '/api/copilot/chat',
      payload: { message: 'Hola copiloto, ayúdame con un gancho para mi episodio' },
    });
    expect(chat.statusCode).toBe(200);
    const chatBody = chat.json() as { reply: string };
    expect(chatBody.reply).toBeTruthy();

    const history = await app.inject({ method: 'GET', url: '/api/copilot/messages' });
    expect(history.statusCode).toBe(200);
    const histBody = history.json() as { messages: Array<{ role: string; content: string }> };
    expect(histBody.messages.length).toBeGreaterThanOrEqual(2);
    expect(histBody.messages.some(m => m.role === 'user')).toBe(true);
    expect(histBody.messages.some(m => m.role === 'assistant')).toBe(true);

    const persisted = JSON.parse(await readFile(copilotFile(), 'utf8')) as {
      messages: unknown[];
    };
    expect(persisted.messages.length).toBeGreaterThanOrEqual(2);
  });

  it('POST /copilot/chat refuses out-of-scope math', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/copilot/chat',
      payload: { message: 'cuanto es 4+9?' },
    });
    expect(response.statusCode).toBe(200);
    const body = response.json() as { reply: string; out_of_scope?: boolean };
    expect(body.out_of_scope).toBe(true);
    expect(body.reply).toContain('no puedo responder');
    expect(body.reply).not.toContain('13');
  });
});

describe('copilot tool invocation', () => {
  let rootDir: string;
  let storageDir: string;
  let storage: EpisodeStorage;

  beforeEach(async () => {
    rootDir = await mkdtemp(path.join(tmpdir(), 'cas-copilot-tools-'));
    storageDir = path.join(rootDir, 'episodes');
    process.env.LOCAL_STORAGE_PATH = storageDir;
    storage = new EpisodeStorage(storageDir);
  });

  afterEach(async () => {
    delete process.env.LOCAL_STORAGE_PATH;
    await rm(rootDir, { recursive: true, force: true });
  });

  it('create_idea tool stores an idea', async () => {
    const { result } = await executeCopilotTool(
      { storage },
      { tool: 'create_idea', args: { rawIdea: 'Reflexión sobre Proverbios 3' } },
    );
    expect(result.success).toBe(true);
    expect(result.data?.ideaId).toBeTruthy();
  });

  it('create_episode tool creates an episode', async () => {
    const { result } = await executeCopilotTool(
      { storage },
      { tool: 'create_episode', args: { title: 'Rut y Noemí' } },
    );
    expect(result.success).toBe(true);
    expect(result.data?.episodeId).toBeTruthy();
  });

  it('publish_episode returns pending confirmation', async () => {
    const created = await storage.createEpisode({ title: 'Test Publish' });
    const { result, pendingActions } = await executeCopilotTool(
      { storage },
      { tool: 'publish_episode', args: { episodeId: created.id } },
    );
    expect(result.success).toBe(true);
    expect(pendingActions).toHaveLength(1);
    expect(pendingActions![0]!.type).toBe('confirm_publish');
  });

  it('parseToolResponse extracts tool calls from JSON', () => {
    const parsed = parseToolResponse(
      '{"tools":[{"tool":"list_episodes","args":{}}],"message":null}',
    );
    expect(parsed.tools).toHaveLength(1);
    expect(parsed.tools[0]!.tool).toBe('list_episodes');
  });
});

describe('chat-scope studio commands', () => {
  it('still blocks math', () => {
    expect(evaluateChatScope([{ role: 'user', content: '4+9' }])).toEqual({
      allowed: false,
      outOfScope: true,
    });
  });

  it('allows studio create commands', () => {
    expect(
      evaluateChatScope([{ role: 'user', content: 'Crea un episodio sobre Rut' }]),
    ).toEqual({ allowed: true, outOfScope: false });
  });
});
