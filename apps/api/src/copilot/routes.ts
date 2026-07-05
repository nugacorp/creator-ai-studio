import type { FastifyInstance } from 'fastify';
import type { EpisodeStorage } from '../storage/index.js';
import { COPILOT_WELCOME, handleCopilotChat, handleCopilotConfirm } from './handler.js';
import { getCopilotMessages, resolveCopilotUserId } from './store.js';
import type { CopilotMessage } from './types.js';

function route(prefix: string, path: string): string {
  return `${prefix}${path}`;
}

export function registerCopilotRoutes(
  app: FastifyInstance,
  prefix: '' | '/api',
  storage: EpisodeStorage,
): void {
  app.get(route(prefix, '/copilot/messages'), async request => {
    const query = request.query as { channelId?: string };
    const channelId =
      typeof query.channelId === 'string' && query.channelId.trim().length > 0
        ? query.channelId.trim()
        : undefined;
    const userId = resolveCopilotUserId(request.userId);
    const messages = await getCopilotMessages(userId, channelId);
    return {
      messages,
      welcome: COPILOT_WELCOME,
    };
  });

  app.post(route(prefix, '/copilot/messages'), async (request, reply) => {
    const body = (request.body ?? {}) as {
      role?: string;
      content?: string;
      channelId?: string;
    };
    if (body.role !== 'user' || !body.content?.trim()) {
      reply.code(400);
      return { error: 'role user and content required' };
    }
    const channelId =
      typeof body.channelId === 'string' && body.channelId.trim().length > 0
        ? body.channelId.trim()
        : undefined;

    const result = await handleCopilotChat({
      storage,
      userId: request.userId,
      channelId,
      message: body.content.trim(),
    });
    reply.code(201);
    return result;
  });

  app.post(route(prefix, '/copilot/chat'), async (request, reply) => {
    const body = (request.body ?? {}) as {
      message?: string;
      channelId?: string;
      activeEpisodeId?: string;
      episodeTitle?: string;
    };
    const message = body.message?.trim();
    if (!message) {
      reply.code(400);
      return { error: 'message is required' };
    }
    const channelId =
      typeof body.channelId === 'string' && body.channelId.trim().length > 0
        ? body.channelId.trim()
        : undefined;

    const result = await handleCopilotChat({
      storage,
      userId: request.userId,
      channelId,
      activeEpisodeId: body.activeEpisodeId,
      episodeTitle: body.episodeTitle,
      message,
    });
    return result;
  });

  app.post(route(prefix, '/copilot/confirm'), async (request, reply) => {
    const body = (request.body ?? {}) as {
      action?: string;
      episodeId?: string;
      channelId?: string;
      scheduledAt?: string;
    };
    if (!body.action || !body.episodeId) {
      reply.code(400);
      return { error: 'action and episodeId required' };
    }
    const channelId =
      typeof body.channelId === 'string' && body.channelId.trim().length > 0
        ? body.channelId.trim()
        : undefined;

    const result = await handleCopilotConfirm(storage, request.userId, channelId, {
      action: body.action,
      episodeId: body.episodeId,
      scheduledAt: body.scheduledAt,
    });
    return result;
  });
}

export type { CopilotMessage };
