import type { FastifyInstance } from 'fastify';
import { isAgentId } from '@creator-ai-studio/shared';
import type { EpisodeStorage } from '../storage/index.js';
import { getEpisodeForUser } from '../storage/access.js';
import { createJob } from '../jobs/store.js';
import { enqueueJob } from '../jobs/queue.js';
import { listAgentDefinitions, getAgentDefinition } from './registry.js';
import { AGENT_SYSTEM_PROMPTS } from './prompts.js';
import { listAgentRuns, getAgentRun, approveAgentRun } from './store.js';
import { runAgent } from './runner.js';

function route(prefix: string, path: string): string {
  return `${prefix}${path}`;
}

export function registerAgentRoutes(
  app: FastifyInstance,
  prefix: '' | '/api',
  storage: EpisodeStorage,
): void {
  app.get(route(prefix, '/agents'), async () => ({
    agents: listAgentDefinitions(),
    orchestrator: 'hermes',
  }));

  app.get(route(prefix, '/agents/:agentId'), async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    const def = getAgentDefinition(agentId);
    if (!def) {
      reply.code(404);
      return { error: 'agent not found' };
    }
    return def;
  });

  app.get(route(prefix, '/agents/:agentId/config'), async (request, reply) => {
    const { agentId } = request.params as { agentId: string };
    if (!isAgentId(agentId)) {
      reply.code(400);
      return { error: 'invalid agent id' };
    }
    const def = getAgentDefinition(agentId);
    if (!def) {
      reply.code(404);
      return { error: 'agent not found' };
    }
    return {
      ...def,
      systemPrompt: AGENT_SYSTEM_PROMPTS[agentId],
      skills: def.expertise,
    };
  });

  app.get(route(prefix, '/episodes/:id/agent-runs'), async (request, reply) => {
    const { id } = request.params as { id: string };
    const episode = await getEpisodeForUser(storage, id, request.userId);
    if (!episode) {
      reply.code(404);
      return { error: 'episode not found' };
    }
    const runs = await listAgentRuns(storage, id);
    return { episodeId: id, runs };
  });

  app.get(route(prefix, '/episodes/:id/agent-runs/:runId'), async (request, reply) => {
    const { id, runId } = request.params as { id: string; runId: string };
    const run = await getAgentRun(storage, id, runId);
    if (!run) {
      reply.code(404);
      return { error: 'agent run not found' };
    }
    return run;
  });

  app.post(route(prefix, '/episodes/:id/agent-runs/:runId/approve'), async (request, reply) => {
    const { id, runId } = request.params as { id: string; runId: string };
    const episode = await getEpisodeForUser(storage, id, request.userId);
    if (!episode) {
      reply.code(404);
      return { error: 'episode not found' };
    }
    const approved = await approveAgentRun(storage, id, runId);
    if (!approved) {
      reply.code(404);
      return { error: 'agent run not found or not awaiting approval' };
    }
    return { run: approved, message: 'Aprobación humana registrada' };
  });

  app.post(route(prefix, '/episodes/:id/agents/:agentId/run'), async (request, reply) => {
    const { id, agentId } = request.params as { id: string; agentId: string };
    const body = (request.body ?? {}) as {
      async?: boolean;
      autoEnqueuePlan?: boolean;
      input?: Record<string, unknown>;
    };

    if (!isAgentId(agentId)) {
      reply.code(400);
      return { error: 'invalid agent id' };
    }

    const episode = await getEpisodeForUser(storage, id, request.userId);
    if (!episode) {
      reply.code(404);
      return { error: 'episode not found' };
    }

    if (body.async !== false) {
      const job = await createJob(id, {
        type: 'agent',
        payload: {
          agentId,
          autoEnqueuePlan: body.autoEnqueuePlan ?? agentId === 'hermes',
          input: body.input,
        },
      });
      await enqueueJob(job);
      reply.code(202);
      return { job, message: 'Agente encolado para ejecución por el worker' };
    }

    try {
      const result = await runAgent(storage, {
        episodeId: id,
        agentId,
        userId: request.userId,
        input: body.input,
        autoEnqueuePlan: body.autoEnqueuePlan ?? (agentId === 'hermes' && body.async === false),
      });
      reply.code(200);
      return result;
    } catch (err) {
      const message = err instanceof Error ? err.message : 'agent failed';
      reply.code(502);
      return {
        error: 'agent_execution_failed',
        message,
        run: (err as { run?: unknown }).run,
      };
    }
  });
}
