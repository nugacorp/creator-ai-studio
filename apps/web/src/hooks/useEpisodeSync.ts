import { useCallback, useEffect, useRef, useState } from 'react';
import type { AgentRunRecord, EpisodeDetail, ProductionJob } from '@creator-ai-studio/shared';
import {
  fetchAgentRuns,
  fetchEpisodeAssets,
  fetchEpisodeDetail,
  fetchEpisodeJobs,
  fetchJob,
  type EpisodeAssetsResponse,
} from '../api';
import { jobStatusLabel } from '../lib/episodeJobLabels';
import { isTransientApiError } from '../lib/pollProductionJob';

const POLL_MS = 2500;
const COMPLETED_APPLY_MS = 8000;

export interface EpisodeSyncNotice {
  text: string;
  kind: 'script' | 'assets' | 'general';
}

export interface EpisodeSyncState {
  detail: EpisodeDetail | null;
  assets: EpisodeAssetsResponse | null;
  jobs: ProductionJob[];
  activeJobs: ProductionJob[];
  runningAgentRuns: AgentRunRecord[];
  primaryJob: ProductionJob | null;
  jobProgress: number;
  jobMessage: string | null;
  revision: number;
  /** True while a background job or agent run is in flight */
  isBackgroundActive: boolean;
  /** Timestamp until which workspace should apply server content */
  applyServerContentUntil: number;
  isLoading: boolean;
  notice: EpisodeSyncNotice | null;
  refresh: () => Promise<void>;
  trackJob: (jobId: string) => void;
  clearNotice: () => void;
}

function isActiveJob(job: ProductionJob): boolean {
  return job.status === 'pending' || job.status === 'active';
}

function pickPrimaryJob(jobs: ProductionJob[]): ProductionJob | null {
  const active = jobs.filter(isActiveJob);
  if (active.length === 0) return null;
  return active.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))[0] ?? null;
}

function detectContentNotice(
  prev: EpisodeDetail | null,
  next: EpisodeDetail,
): EpisodeSyncNotice | null {
  const prevScript = prev?.content.script?.trim() ?? '';
  const nextScript = next.content.script?.trim() ?? '';
  if (nextScript.length > 100 && nextScript !== prevScript) {
    return { text: '✓ Guion actualizado — revisa abajo', kind: 'script' };
  }
  if ((next.content.scenes?.length ?? 0) > (prev?.content.scenes?.length ?? 0)) {
    return { text: '✓ Escenas actualizadas — revisa la pestaña Escenas', kind: 'general' };
  }
  if (next.content.videoUrl && next.content.videoUrl !== prev?.content.videoUrl) {
    return { text: '✓ Video renderizado — revisa la pestaña Video', kind: 'assets' };
  }
  if (next.content.audioUrl && next.content.audioUrl !== prev?.content.audioUrl) {
    return { text: '✓ Narración lista — revisa la pestaña Narración', kind: 'assets' };
  }
  return null;
}

export function useEpisodeSync(episodeId: string | null | undefined): EpisodeSyncState {
  const [detail, setDetail] = useState<EpisodeDetail | null>(null);
  const [assets, setAssets] = useState<EpisodeAssetsResponse | null>(null);
  const [jobs, setJobs] = useState<ProductionJob[]>([]);
  const [runningAgentRuns, setRunningAgentRuns] = useState<AgentRunRecord[]>([]);
  const [revision, setRevision] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [notice, setNotice] = useState<EpisodeSyncNotice | null>(null);
  const [applyServerContentUntil, setApplyServerContentUntil] = useState(0);

  const watchedJobIds = useRef<Set<string>>(new Set());
  const prevDetailRef = useRef<EpisodeDetail | null>(null);
  const hadActiveRef = useRef(false);

  const trackJob = useCallback((jobId: string) => {
    watchedJobIds.current.add(jobId);
  }, []);

  const clearNotice = useCallback(() => setNotice(null), []);

  const refresh = useCallback(async () => {
    if (!episodeId) return;
    setIsLoading(true);
    try {
      const [nextDetail, nextAssets, episodeJobsRaw, runsData] = await Promise.all([
        fetchEpisodeDetail(episodeId).catch(() => null),
        fetchEpisodeAssets(episodeId).catch(() => null),
        fetchEpisodeJobs(episodeId).catch(() => [] as ProductionJob[]),
        fetchAgentRuns(episodeId).catch(() => ({ runs: [] as AgentRunRecord[] })),
      ]);

      if (!nextDetail) return;

      const tracked = await Promise.all(
        [...watchedJobIds.current].map(async id => {
          try {
            return await fetchJob(id);
          } catch (err) {
            if (isTransientApiError(err)) return null;
            watchedJobIds.current.delete(id);
            return null;
          }
        }),
      );

      const episodeJobs = Array.isArray(episodeJobsRaw) ? episodeJobsRaw : [];

      const mergedJobs = [...episodeJobs];
      for (const trackedJob of tracked) {
        if (!trackedJob) continue;
        const idx = mergedJobs.findIndex(j => j.id === trackedJob.id);
        if (idx >= 0) mergedJobs[idx] = trackedJob;
        else mergedJobs.push(trackedJob);
        if (trackedJob.status === 'completed' || trackedJob.status === 'failed') {
          watchedJobIds.current.delete(trackedJob.id);
        }
      }

      const contentNotice = detectContentNotice(prevDetailRef.current, nextDetail);
      if (contentNotice) setNotice(contentNotice);

      prevDetailRef.current = nextDetail;
      setDetail(nextDetail);
      setAssets(nextAssets);
      setJobs(mergedJobs);
      setRunningAgentRuns((runsData.runs ?? []).filter(r => r.status === 'running'));
      setRevision(r => r + 1);
    } finally {
      setIsLoading(false);
    }
  }, [episodeId]);

  useEffect(() => {
    if (!episodeId) {
      setDetail(null);
      setAssets(null);
      setJobs([]);
      setRunningAgentRuns([]);
      prevDetailRef.current = null;
      return;
    }
    watchedJobIds.current.clear();
    prevDetailRef.current = null;
    void refresh();
  }, [episodeId, refresh]);

  const activeJobs = jobs.filter(isActiveJob);
  const isBackgroundActive =
    activeJobs.length > 0 || runningAgentRuns.length > 0;
  const primaryJob = pickPrimaryJob(jobs);
  const jobProgress = primaryJob?.progress ?? 0;
  const jobMessage = primaryJob ? jobStatusLabel(primaryJob) : null;

  useEffect(() => {
    if (!episodeId) return;

    if (isBackgroundActive) {
      hadActiveRef.current = true;
      const interval = window.setInterval(() => {
        void refresh();
      }, POLL_MS);
      return () => window.clearInterval(interval);
    }

    if (hadActiveRef.current) {
      hadActiveRef.current = false;
      setApplyServerContentUntil(Date.now() + COMPLETED_APPLY_MS);
      void refresh();
    }
  }, [episodeId, isBackgroundActive, refresh]);

  return {
    detail,
    assets,
    jobs,
    activeJobs,
    runningAgentRuns,
    primaryJob,
    jobProgress,
    jobMessage,
    revision,
    isBackgroundActive,
    applyServerContentUntil,
    isLoading,
    notice,
    refresh,
    trackJob,
    clearNotice,
  };
}
