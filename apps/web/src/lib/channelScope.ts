import type { VideoProject } from '../types';

/** True when the project belongs to the given YouTube channel (or no filter). */
export function projectMatchesChannel(
  project: Pick<VideoProject, 'channelId'>,
  channelId: string | null | undefined,
): boolean {
  if (!channelId) return true;
  return project.channelId === channelId;
}

/** Filter projects to the active channel workspace. */
export function filterProjectsByChannel(
  projects: VideoProject[],
  channelId: string | null | undefined,
  activeOnly = true,
): VideoProject[] {
  if (!activeOnly || !channelId) return projects;
  return projects.filter(p => projectMatchesChannel(p, channelId));
}
