import type { FastifyInstance } from 'fastify';
import type { CreateIdeaInput } from '@creator-ai-studio/shared';
import type { EpisodeStorage } from '../storage/index.js';
import { createIdeaBody } from '../http/schemas.js';
import { brainstormIdeaProposals } from './brainstorm.js';
import { approveIdeaProposal, discardIdeaProposal } from './approve.js';
import { createIdea, deleteIdea, getIdea, listIdeas, saveIdea } from './store.js';

function route(prefix: string, path: string): string {
  return `${prefix}${path}`;
}

export function registerIdeaRoutes(
  app: FastifyInstance,
  prefix: '' | '/api',
  storage: EpisodeStorage,
): void {
  app.get(route(prefix, '/ideas'), async request => {
    const query = request.query as { channelId?: string };
    const channelId =
      typeof query.channelId === 'string' && query.channelId.trim().length > 0
        ? query.channelId.trim()
        : undefined;
    const ideas = await listIdeas(request.userId, channelId);
    return { ideas };
  });

  app.get(route(prefix, '/ideas/:id'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const idea = await getIdea(id);
    if (!idea) {
      reply.code(404);
      return { error: 'idea not found' };
    }
    return idea;
  });

  app.post(route(prefix, '/ideas'), { schema: { body: createIdeaBody } }, async (request, reply) => {
    const body = request.body as CreateIdeaInput;
    if (!body.rawIdea?.trim()) {
      reply.code(400);
      return { error: 'rawIdea is required' };
    }
    const idea = await createIdea(body, request.userId);
    reply.code(201);
    return idea;
  });

  app.post(route(prefix, '/ideas/:id/brainstorm'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const idea = await getIdea(id);
    if (!idea) {
      reply.code(404);
      return { error: 'idea not found' };
    }
    if (idea.status === 'approved') {
      reply.code(409);
      return { error: 'idea already approved' };
    }

    const proposals = await brainstormIdeaProposals({
      rawIdea: idea.rawIdea,
      audience: idea.audience,
      passage: idea.passage,
    });

    const merged = [...idea.proposals.filter(p => p.status !== 'pending'), ...proposals];
    const updated = await saveIdea({
      ...idea,
      proposals: merged,
      status: 'brainstormed',
    });

    return { idea: updated, proposals };
  });

  app.patch(route(prefix, '/ideas/:id/proposals/:proposalId/approve'), async (request, reply) => {
    const { id, proposalId } = request.params as { id: string; proposalId: string };
    try {
      const result = await approveIdeaProposal(storage, id, proposalId, request.userId);
      const { syncEpisodeToSupabase } = await import('../db/episodes-sync.js');
      const detail = await storage.getEpisode(result.episodeId);
      if (detail) await syncEpisodeToSupabase(detail);
      return {
        ...result,
        message: 'Idea aprobada — episodio creado e investigador encolado',
      };
    } catch (err) {
      const code = err instanceof Error ? err.message : 'approve_failed';
      if (code === 'idea_not_found' || code === 'proposal_not_found') {
        reply.code(404);
        return { error: code };
      }
      if (code === 'idea_already_approved' || code === 'proposal_discarded') {
        reply.code(409);
        return { error: code };
      }
      if (code === 'max_active_episodes') {
        reply.code(409);
        return {
          error: code,
          message: 'Límite de episodios activos alcanzado. Archiva o publica uno antes de aprobar.',
        };
      }
      reply.code(500);
      return { error: code };
    }
  });

  app.patch(route(prefix, '/ideas/:id/proposals/:proposalId/discard'), async (request, reply) => {
    const { id, proposalId } = request.params as { id: string; proposalId: string };
    try {
      const idea = await discardIdeaProposal(id, proposalId);
      return { idea, message: 'Propuesta descartada' };
    } catch (err) {
      const code = err instanceof Error ? err.message : 'discard_failed';
      if (code === 'idea_not_found' || code === 'proposal_not_found') {
        reply.code(404);
        return { error: code };
      }
      if (code === 'proposal_already_approved') {
        reply.code(409);
        return { error: code };
      }
      reply.code(500);
      return { error: code };
    }
  });

  app.delete(route(prefix, '/ideas/:id'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const idea = await getIdea(id);
    if (!idea) {
      reply.code(404);
      return { error: 'idea not found' };
    }
    if (idea.status === 'approved' && idea.episodeId) {
      reply.code(409);
      return { error: 'cannot delete approved idea with linked episode' };
    }
    await deleteIdea(id);
    return { ok: true, id };
  });
}
