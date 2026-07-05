import { randomUUID } from 'node:crypto';
import { isAgentId, EPISODE_TO_PROJECT_STATUS } from '@creator-ai-studio/shared';
import type { EpisodeStorage } from '../storage/index.js';
import { getEpisodeForUser } from '../storage/access.js';
import { createIdea, getIdea, saveIdea } from '../ideas/store.js';
import { brainstormIdeaProposals } from '../ideas/brainstorm.js';
import { createJob } from '../jobs/store.js';
import { enqueueJob } from '../jobs/queue.js';
import { getSettings } from '../settings/store.js';
import type { CopilotPendingAction, CopilotToolCall, CopilotToolResult } from './types.js';

export interface CopilotToolContext {
  storage: EpisodeStorage;
  userId?: string;
  channelId?: string;
  activeEpisodeId?: string;
}

async function resolveEpisodeId(
  ctx: CopilotToolContext,
  args: Record<string, unknown>,
): Promise<string | null> {
  const fromArgs = typeof args.episodeId === 'string' ? args.episodeId.trim() : '';
  if (fromArgs) return fromArgs;
  if (ctx.activeEpisodeId) return ctx.activeEpisodeId;
  const episodes = await ctx.storage.listEpisodes(ctx.userId, ctx.channelId);
  if (episodes.length === 1) return episodes[0]!.id;
  return null;
}

export async function executeCopilotTool(
  ctx: CopilotToolContext,
  call: CopilotToolCall,
): Promise<{ result: CopilotToolResult; pendingActions?: CopilotPendingAction[] }> {
  const { tool, args } = call;

  try {
    switch (tool) {
      case 'create_idea': {
        const rawIdea = typeof args.rawIdea === 'string' ? args.rawIdea.trim() : '';
        if (!rawIdea) {
          return {
            result: { tool, success: false, summary: 'Falta rawIdea para crear la idea.' },
          };
        }
        const idea = await createIdea(
          {
            rawIdea,
            audience: typeof args.audience === 'string' ? args.audience : undefined,
            passage: typeof args.passage === 'string' ? args.passage : undefined,
            channelId: ctx.channelId ?? (typeof args.channelId === 'string' ? args.channelId : undefined),
          },
          ctx.userId,
        );
        return {
          result: {
            tool,
            success: true,
            summary: `Idea creada: "${idea.rawIdea.slice(0, 60)}${idea.rawIdea.length > 60 ? '…' : ''}"`,
            data: { ideaId: idea.id, rawIdea: idea.rawIdea },
          },
        };
      }

      case 'brainstorm_ideas': {
        const ideaId = typeof args.ideaId === 'string' ? args.ideaId.trim() : '';
        if (!ideaId) {
          return { result: { tool, success: false, summary: 'Falta ideaId para brainstorm.' } };
        }
        const idea = await getIdea(ideaId);
        if (!idea) {
          return { result: { tool, success: false, summary: 'Idea no encontrada.' } };
        }
        const proposals = await brainstormIdeaProposals({
          rawIdea: idea.rawIdea,
          audience: idea.audience,
          passage: idea.passage,
        });
        const merged = [...idea.proposals.filter(p => p.status !== 'pending'), ...proposals];
        await saveIdea({ ...idea, proposals: merged, status: 'brainstormed' });
        return {
          result: {
            tool,
            success: true,
            summary: `${proposals.length} propuesta(s) generada(s) para la idea.`,
            data: { ideaId, proposalCount: proposals.length },
          },
        };
      }

      case 'create_episode': {
        const title = typeof args.title === 'string' ? args.title.trim() : '';
        if (!title) {
          return { result: { tool, success: false, summary: 'Falta title para crear el episodio.' } };
        }
        const settings = await getSettings();
        const activeCount = await ctx.storage.countActiveLocalEpisodes(ctx.userId);
        if (activeCount >= settings.maxActiveEpisodes) {
          return {
            result: {
              tool,
              success: false,
              summary: `Límite de ${settings.maxActiveEpisodes} episodio(s) activo(s). Archiva o publica uno antes de crear otro.`,
            },
          };
        }
        const episode = await ctx.storage.createEpisode(
          {
            title,
            channelId:
              ctx.channelId ?? (typeof args.channelId === 'string' ? args.channelId : undefined),
          },
          ctx.userId,
        );
        return {
          result: {
            tool,
            success: true,
            summary: `Episodio creado: "${episode.title}"`,
            data: { episodeId: episode.id, title: episode.title, workspaceHint: 'projects' },
          },
        };
      }

      case 'open_episode': {
        const episodeId = await resolveEpisodeId(ctx, args);
        if (!episodeId) {
          return {
            result: {
              tool,
              success: false,
              summary: 'Indica episodeId o selecciona un episodio activo.',
            },
          };
        }
        const episode = await getEpisodeForUser(ctx.storage, episodeId, ctx.userId);
        if (!episode) {
          return { result: { tool, success: false, summary: 'Episodio no encontrado.' } };
        }
        return {
          result: {
            tool,
            success: true,
            summary: `Abre el workspace del episodio "${episode.title}".`,
            data: { episodeId, title: episode.title, workspaceHint: 'workspace' },
          },
        };
      }

      case 'update_script': {
        const episodeId = await resolveEpisodeId(ctx, args);
        const script = typeof args.script === 'string' ? args.script : '';
        if (!episodeId || !script.trim()) {
          return {
            result: {
              tool,
              success: false,
              summary: 'Indica episodeId y script para actualizar el guion.',
            },
          };
        }
        const existing = await getEpisodeForUser(ctx.storage, episodeId, ctx.userId);
        if (!existing) {
          return { result: { tool, success: false, summary: 'Episodio no encontrado.' } };
        }
        await ctx.storage.updateEpisode(episodeId, { content: { script } });
        return {
          result: {
            tool,
            success: true,
            summary: `Guion actualizado en "${existing.title}".`,
            data: { episodeId, title: existing.title },
          },
        };
      }

      case 'update_outline': {
        const episodeId = await resolveEpisodeId(ctx, args);
        const outlineRaw = args.outline;
        const outline = Array.isArray(outlineRaw)
          ? outlineRaw.filter((item): item is string => typeof item === 'string')
          : typeof outlineRaw === 'string'
            ? outlineRaw.split('\n').map(s => s.trim()).filter(Boolean)
            : [];
        if (!episodeId || outline.length === 0) {
          return {
            result: {
              tool,
              success: false,
              summary: 'Indica episodeId y outline (array o texto con saltos de línea).',
            },
          };
        }
        const existing = await getEpisodeForUser(ctx.storage, episodeId, ctx.userId);
        if (!existing) {
          return { result: { tool, success: false, summary: 'Episodio no encontrado.' } };
        }
        await ctx.storage.updateEpisode(episodeId, { content: { outline } });
        return {
          result: {
            tool,
            success: true,
            summary: `Outline actualizado (${outline.length} puntos) en "${existing.title}".`,
            data: { episodeId, title: existing.title },
          },
        };
      }

      case 'run_agent': {
        const episodeId = await resolveEpisodeId(ctx, args);
        const agentId = typeof args.agentId === 'string' ? args.agentId.trim() : '';
        if (!episodeId || !agentId) {
          return {
            result: {
              tool,
              success: false,
              summary: 'Indica episodeId y agentId (p. ej. scriptwriter, researcher, seo_optimizer).',
            },
          };
        }
        if (!isAgentId(agentId)) {
          return { result: { tool, success: false, summary: `Agente inválido: ${agentId}` } };
        }
        const episode = await getEpisodeForUser(ctx.storage, episodeId, ctx.userId);
        if (!episode) {
          return { result: { tool, success: false, summary: 'Episodio no encontrado.' } };
        }
        const job = await createJob(episodeId, {
          type: 'agent',
          payload: {
            agentId,
            autoEnqueuePlan: agentId === 'hermes',
            input: typeof args.input === 'object' && args.input ? args.input : undefined,
          },
        });
        await enqueueJob(job);
        return {
          result: {
            tool,
            success: true,
            summary: `Agente "${agentId}" encolado para "${episode.title}".`,
            data: { episodeId, agentId, jobId: job.id },
          },
        };
      }

      case 'schedule_publish': {
        const episodeId = await resolveEpisodeId(ctx, args);
        const scheduledAt = typeof args.scheduledAt === 'string' ? args.scheduledAt.trim() : '';
        if (!episodeId || !scheduledAt) {
          return {
            result: {
              tool,
              success: false,
              summary: 'Indica episodeId y scheduledAt (ISO 8601).',
            },
          };
        }
        const existing = await getEpisodeForUser(ctx.storage, episodeId, ctx.userId);
        if (!existing) {
          return { result: { tool, success: false, summary: 'Episodio no encontrado.' } };
        }
        await ctx.storage.updateEpisode(episodeId, {
          content: { scheduledAt },
          status: 'review',
        });
        return {
          result: {
            tool,
            success: true,
            summary: `Publicación programada para ${scheduledAt} en "${existing.title}".`,
            data: { episodeId, scheduledAt },
          },
        };
      }

      case 'publish_episode': {
        const episodeId = await resolveEpisodeId(ctx, args);
        if (!episodeId) {
          return {
            result: {
              tool,
              success: false,
              summary: 'Indica qué episodio publicar (episodeId).',
            },
          };
        }
        const episode = await getEpisodeForUser(ctx.storage, episodeId, ctx.userId);
        if (!episode) {
          return { result: { tool, success: false, summary: 'Episodio no encontrado.' } };
        }
        const actionId = randomUUID();
        return {
          result: {
            tool,
            success: true,
            summary: `Publicación pendiente de confirmación para "${episode.title}".`,
            data: { episodeId, requiresConfirmation: true, actionId },
          },
          pendingActions: [
            {
              id: actionId,
              type: 'confirm_publish',
              episodeId,
              episodeTitle: episode.title,
              label: 'Confirmar publicación',
            },
          ],
        };
      }

      case 'list_episodes': {
        const episodes = await ctx.storage.listEpisodes(ctx.userId, ctx.channelId);
        const items = episodes.slice(0, 20).map(e => ({
          id: e.id,
          title: e.title,
          status: e.status,
          kanban: EPISODE_TO_PROJECT_STATUS[e.status],
        }));
        return {
          result: {
            tool,
            success: true,
            summary: `${episodes.length} episodio(s) en el canal activo.`,
            data: { episodes: items, total: episodes.length },
          },
        };
      }

      case 'get_episode_status': {
        const episodeId = await resolveEpisodeId(ctx, args);
        if (!episodeId) {
          return {
            result: {
              tool,
              success: false,
              summary: 'Indica episodeId o selecciona un episodio activo.',
            },
          };
        }
        const episode = await getEpisodeForUser(ctx.storage, episodeId, ctx.userId);
        if (!episode) {
          return { result: { tool, success: false, summary: 'Episodio no encontrado.' } };
        }
        const stages = episode.stages.map(s => ({
          stage: s.stage,
          status: s.status,
        }));
        return {
          result: {
            tool,
            success: true,
            summary: `"${episode.title}" — ${episode.status}, columna ${EPISODE_TO_PROJECT_STATUS[episode.status]}.`,
            data: {
              episodeId,
              title: episode.title,
              status: episode.status,
              kanban: EPISODE_TO_PROJECT_STATUS[episode.status],
              stages,
              scheduledAt: episode.content.scheduledAt ?? null,
            },
          },
        };
      }

      default:
        return {
          result: { tool, success: false, summary: `Herramienta desconocida: ${tool}` },
        };
    }
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Error ejecutando herramienta';
    return { result: { tool, success: false, summary: message } };
  }
}

export const COPILOT_TOOL_NAMES = [
  'create_idea',
  'brainstorm_ideas',
  'create_episode',
  'open_episode',
  'update_script',
  'update_outline',
  'run_agent',
  'schedule_publish',
  'publish_episode',
  'list_episodes',
  'get_episode_status',
] as const;

export async function confirmCopilotPublish(
  ctx: CopilotToolContext,
  episodeId: string,
  scheduledAt?: string,
): Promise<CopilotToolResult> {
  const episode = await getEpisodeForUser(ctx.storage, episodeId, ctx.userId);
  if (!episode) {
    return { tool: 'publish_episode', success: false, summary: 'Episodio no encontrado.' };
  }
  const dir = await ctx.storage.getEpisodeDirectory(episodeId);
  if (!dir) {
    return {
      tool: 'publish_episode',
      success: false,
      summary: 'Episodio no disponible en disco local.',
    };
  }
  const { buildPublishPackage } = await import('../publish/package.js');
  const pkg = await buildPublishPackage(episode, dir);
  if (!pkg.ready) {
    return {
      tool: 'publish_episode',
      success: false,
      summary: 'Paquete de publicación incompleto. Completa los artefactos primero.',
      data: { checklist: pkg.checklist },
    };
  }
  if (scheduledAt) {
    await ctx.storage.updateEpisode(episodeId, { content: { scheduledAt } });
  }
  const job = await createJob(episodeId, {
    type: 'pipeline',
    payload: {
      mode: 'publish-authorized',
      authorized: true,
      scheduledAt,
    },
  });
  await enqueueJob(job);
  return {
    tool: 'publish_episode',
    success: true,
    summary: `Publicación autorizada y encolada para "${episode.title}".`,
    data: { episodeId, jobId: job.id },
  };
}
