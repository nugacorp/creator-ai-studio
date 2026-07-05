import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import type { EpisodeIdea, IdeaProposal } from '@creator-ai-studio/shared';
import type { EpisodeStorage } from '../storage/index.js';
import { createJob } from '../jobs/store.js';
import { enqueueJob } from '../jobs/queue.js';
import { getSettings } from '../settings/store.js';
import { getIdea, saveIdea } from './store.js';

function buildResearchBrief(idea: EpisodeIdea, proposal: IdeaProposal): string {
  const lines = [
    `# Brief de investigación`,
    '',
    `## Idea original`,
    idea.rawIdea,
    '',
  ];
  if (idea.audience) lines.push(`## Audiencia`, idea.audience, '');
  if (idea.passage) lines.push(`## Pasaje / referencia`, idea.passage, '');
  lines.push(`## Título aprobado`, proposal.title, '', `## Ángulos a desarrollar`);
  for (const point of proposal.points) {
    lines.push(`- ${point}`);
  }
  return lines.join('\n');
}

export async function approveIdeaProposal(
  storage: EpisodeStorage,
  ideaId: string,
  proposalId: string,
  userId?: string,
): Promise<{ idea: EpisodeIdea; episodeId: string; jobId?: string }> {
  const idea = await getIdea(ideaId);
  if (!idea) {
    throw new Error('idea_not_found');
  }
  if (idea.status === 'approved' && idea.episodeId) {
    throw new Error('idea_already_approved');
  }

  const proposal = idea.proposals.find(p => p.id === proposalId);
  if (!proposal) {
    throw new Error('proposal_not_found');
  }
  if (proposal.status === 'discarded') {
    throw new Error('proposal_discarded');
  }

  const settings = await getSettings();
  const activeCount = await storage.countActiveLocalEpisodes(userId);
  if (activeCount >= settings.maxActiveEpisodes) {
    throw new Error('max_active_episodes');
  }

  const channelId = idea.channelId ?? settings.activeChannelId;
  const episode = await storage.createEpisode(
    { title: proposal.title, ...(channelId ? { channelId } : {}) },
    userId,
  );
  const researchBrief = buildResearchBrief(idea, proposal);
  const dir = await storage.getEpisodeDirectory(episode.id);
  if (!dir) {
    throw new Error('episode_directory_missing');
  }

  await mkdir(path.join(dir, '01-research'), { recursive: true });
  await writeFile(path.join(dir, '01-research', 'brief.md'), `${researchBrief}\n`, 'utf8');

  await storage.updateEpisode(episode.id, {
    content: {
      ...(channelId ? { channelId } : {}),
      outline: proposal.points,
      researchBrief,
      rawIdea: idea.rawIdea,
      kanbanColumn: 'Investigación',
      seoTitles: [proposal.title],
    },
  });

  const updatedProposals = idea.proposals.map(p => ({
    ...p,
    status:
      p.id === proposalId
        ? ('approved' as const)
        : p.status === 'pending'
          ? ('discarded' as const)
          : p.status,
  }));

  const updatedIdea = await saveIdea({
    ...idea,
    proposals: updatedProposals,
    approvedProposalId: proposalId,
    episodeId: episode.id,
    status: 'approved',
  });

  const job = await createJob(episode.id, {
    type: 'agent',
    payload: { agentId: 'researcher', autoEnqueuePlan: false },
  });
  await enqueueJob(job);

  return { idea: updatedIdea, episodeId: episode.id, jobId: job.id };
}

export async function discardIdeaProposal(
  ideaId: string,
  proposalId: string,
): Promise<EpisodeIdea> {
  const idea = await getIdea(ideaId);
  if (!idea) {
    throw new Error('idea_not_found');
  }

  const proposal = idea.proposals.find(p => p.id === proposalId);
  if (!proposal) {
    throw new Error('proposal_not_found');
  }
  if (proposal.status === 'approved') {
    throw new Error('proposal_already_approved');
  }

  const updatedProposals = idea.proposals.map(p =>
    p.id === proposalId ? { ...p, status: 'discarded' as const } : p,
  );

  const allDiscarded = updatedProposals.every(p => p.status === 'discarded');
  return saveIdea({
    ...idea,
    proposals: updatedProposals,
    status: allDiscarded ? 'discarded' : idea.status === 'draft' ? 'brainstormed' : idea.status,
  });
}
