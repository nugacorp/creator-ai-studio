/** Status of a single AI-generated title/angle proposal. */
export type IdeaProposalStatus = 'pending' | 'approved' | 'discarded';

/** One brainstormed title option with bullet angles. */
export interface IdeaProposal {
  id: string;
  title: string;
  points: string[];
  status: IdeaProposalStatus;
  createdAt: string;
}

/** Lifecycle of an ideation record before/during production kickoff. */
export type EpisodeIdeaStatus = 'draft' | 'brainstormed' | 'approved' | 'discarded';

/** Pre-production idea captured by the creator before an episode exists. */
export interface EpisodeIdea {
  id: string;
  rawIdea: string;
  audience?: string;
  passage?: string;
  proposals: IdeaProposal[];
  approvedProposalId?: string;
  /** Linked episode after approval. */
  episodeId?: string;
  status: EpisodeIdeaStatus;
  createdAt: string;
  updatedAt: string;
  userId?: string;
}

export interface CreateIdeaInput {
  rawIdea: string;
  audience?: string;
  passage?: string;
}
