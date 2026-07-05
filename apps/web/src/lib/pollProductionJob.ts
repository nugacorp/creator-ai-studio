import type { ProductionJob } from '@creator-ai-studio/shared';
import { ApiHttpError } from '../api';

const TRANSIENT_STATUSES = new Set([502, 503, 504, 429]);

export function isTransientApiError(err: unknown): boolean {
  if (err instanceof ApiHttpError) {
    return TRANSIENT_STATUSES.has(err.status);
  }
  // fetch() network failures (offline, connection reset during redeploy)
  if (err instanceof TypeError) {
    return true;
  }
  if (err instanceof Error && /failed to fetch|network|load failed/i.test(err.message)) {
    return true;
  }
  return false;
}

export interface PollProductionJobOptions {
  intervalMs?: number;
  /** Stop retrying transient errors after this many ms (default 3 min). */
  maxTransientMs?: number;
}

export interface PollProductionJobHandlers {
  onUpdate: (job: ProductionJob) => void;
  onCompleted: (job: ProductionJob) => void;
  onFailed: (job: ProductionJob) => void;
  /** Shown while API/proxy is briefly unavailable (redeploy). */
  onWaitingForApi?: () => void;
  onFatalError?: (err: Error) => void;
}

/** Poll GET /jobs/:id until terminal state; retries 502/503 during deploys. */
export function pollProductionJob(
  jobId: string,
  handlers: PollProductionJobHandlers,
  options?: PollProductionJobOptions,
): () => void {
  const intervalMs = options?.intervalMs ?? 2000;
  const maxTransientMs = options?.maxTransientMs ?? 180_000;
  let transientSince: number | null = null;

  const tick = async () => {
    try {
      const { fetchJob } = await import('../api');
      const updated = await fetchJob(jobId);
      transientSince = null;
      handlers.onUpdate(updated);
      if (updated.status === 'completed') {
        window.clearInterval(poll);
        handlers.onCompleted(updated);
      } else if (updated.status === 'failed') {
        window.clearInterval(poll);
        handlers.onFailed(updated);
      }
    } catch (err) {
      if (isTransientApiError(err)) {
        if (transientSince === null) transientSince = Date.now();
        handlers.onWaitingForApi?.();
        if (Date.now() - transientSince > maxTransientMs) {
          window.clearInterval(poll);
          handlers.onFatalError?.(
            err instanceof Error ? err : new Error('El servidor no respondió a tiempo'),
          );
        }
        return;
      }
      window.clearInterval(poll);
      handlers.onFatalError?.(
        err instanceof Error ? err : new Error('Error al consultar el progreso del job'),
      );
    }
  };

  const poll = window.setInterval(() => {
    void tick();
  }, intervalMs);
  void tick();

  return () => window.clearInterval(poll);
}
