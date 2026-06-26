import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactElement,
} from 'react';
import { FilePlus2, LayoutGrid, ListChecks } from 'lucide-react';
import type {
  EpisodeDetail,
  EpisodeStage,
  EpisodeStageStatus,
  EpisodeSummary,
} from '@creator-ai-studio/shared';
import {
  createEpisode,
  fetchEpisodeDetail,
  fetchEpisodes,
  updateStageStatus,
} from '../api';

const STAGE_ACTIONS: EpisodeStageStatus[] = [
  'in_progress',
  'completed',
  'blocked',
];

const STATUS_PILL: Record<EpisodeStageStatus, string> = {
  pending: 'border-slate-500/20 bg-slate-500/10 text-slate-300',
  in_progress: 'border-indigo-500/20 bg-indigo-500/10 text-indigo-300',
  completed: 'border-emerald-500/20 bg-emerald-500/10 text-emerald-300',
  blocked: 'border-rose-500/20 bg-rose-500/10 text-rose-300',
};

const CARD = 'rounded-3xl border border-white/5 bg-[#15191E] p-5';
const ICON_CHIP = 'rounded-xl bg-indigo-500/10 p-2.5 text-indigo-400';

export function EpisodesView(): ReactElement {
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<EpisodeDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  const loadEpisodes = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      setEpisodes(await fetchEpisodes());
    } catch {
      setError('Could not load episodes');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadEpisodes();
  }, [loadEpisodes]);

  async function selectEpisode(id: string): Promise<void> {
    setSelectedId(id);
    setDetail(null);
    setDetailLoading(true);
    setError(null);
    try {
      setDetail(await fetchEpisodeDetail(id));
    } catch {
      setError('Could not load episode detail');
    } finally {
      setDetailLoading(false);
    }
  }

  async function changeStage(
    stage: EpisodeStage,
    status: EpisodeStageStatus,
  ): Promise<void> {
    if (selectedId === null) {
      return;
    }
    setError(null);
    try {
      setDetail(await updateStageStatus(selectedId, stage, status));
    } catch {
      setError('Could not update stage');
    }
  }

  async function handleSubmit(
    event: FormEvent<HTMLFormElement>,
  ): Promise<void> {
    event.preventDefault();
    const trimmed = title.trim();
    if (trimmed.length === 0) {
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      await createEpisode({ title: trimmed });
      setTitle('');
      await loadEpisodes();
    } catch {
      setError('Could not create episode');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.25fr)]">
      <div className="space-y-6">
        <section className={`${CARD} space-y-4`}>
          <div className="flex items-center gap-3">
            <div className={ICON_CHIP}>
              <FilePlus2 className="h-5 w-5" />
            </div>
            <div>
              <h2 className="font-display text-base font-bold text-white">
                Create Episode
              </h2>
              <p className="text-[11px] text-slate-400">
                Start a new production workspace
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-3">
            <label
              htmlFor="episode-title"
              className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400"
            >
              Title
            </label>
            <input
              id="episode-title"
              name="title"
              value={title}
              placeholder="Episode title"
              onChange={(event) => setTitle(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#0B0F14] px-3 py-2 text-sm text-white placeholder-slate-500 transition-colors focus:border-indigo-500/50 focus:outline-none"
            />
            <button
              type="submit"
              disabled={submitting}
              className="w-full rounded-xl bg-indigo-600 px-4 py-2 text-sm font-bold text-white transition-colors hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {submitting ? 'Creating…' : 'Create episode'}
            </button>
          </form>
        </section>

        <section className={`${CARD} space-y-4`}>
          <div className="flex items-center gap-3">
            <div className={ICON_CHIP}>
              <LayoutGrid className="h-5 w-5" />
            </div>
            <h2 className="font-display text-base font-bold text-white">
              Episodes
            </h2>
          </div>

          {error !== null ? (
            <p
              role="alert"
              className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-xs text-rose-300"
            >
              {error}
            </p>
          ) : null}

          {loading ? (
            <p className="text-sm text-slate-400">Loading episodes…</p>
          ) : episodes.length === 0 ? (
            <p className="text-sm text-slate-400">No episodes created yet</p>
          ) : (
            <ul className="space-y-3">
              {episodes.map((episode) => {
                const isActive = episode.id === selectedId;
                return (
                  <li key={episode.id}>
                    <button
                      type="button"
                      aria-pressed={isActive}
                      onClick={() => {
                        void selectEpisode(episode.id);
                      }}
                      className={`flex w-full items-center justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-all ${
                        isActive
                          ? 'border-indigo-500/40 bg-indigo-500/5'
                          : 'border-white/5 bg-[#0B0F14] hover:border-indigo-500/30'
                      }`}
                    >
                      <span className="truncate text-sm font-semibold text-white">
                        {episode.title}
                      </span>
                      <span className="rounded-full border border-white/10 bg-white/5 px-2 py-0.5 font-mono text-[10px] uppercase tracking-wide text-slate-300">
                        {episode.status}
                      </span>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      <section className={`${CARD} space-y-4`} aria-label="Episode detail">
        <div className="flex items-center gap-3">
          <div className={ICON_CHIP}>
            <ListChecks className="h-5 w-5" />
          </div>
          <h2 className="font-display text-base font-bold text-white">
            Episode Detail
          </h2>
        </div>

        {selectedId === null ? (
          <p className="text-sm text-slate-400">No episode selected</p>
        ) : detailLoading ? (
          <p className="text-sm text-slate-400">Loading detail…</p>
        ) : detail === null ? (
          <p className="text-sm text-slate-400">No episode selected</p>
        ) : (
          <article className="space-y-5">
            <div className="space-y-1">
              <h3 className="font-display text-lg font-bold text-white">
                {detail.title}
              </h3>
              <p className="text-xs text-slate-400">Status: {detail.status}</p>
              <p className="font-mono text-[11px] text-slate-500">
                Workspace: {detail.workspacePath}
              </p>
            </div>

            <div className="space-y-3">
              <h4 className="font-mono text-[11px] font-bold uppercase tracking-wider text-slate-400">
                Stages
              </h4>
              <ol className="space-y-2">
                {detail.stages.map((stage) => (
                  <li
                    key={stage.stage}
                    className="flex flex-col gap-2 rounded-2xl border border-white/5 bg-[#0B0F14] p-3 sm:flex-row sm:items-center sm:justify-between"
                  >
                    <span className="flex items-center gap-2 text-sm text-[#E6EDF2]">
                      <span className="font-medium">
                        {stage.stage}: {stage.status}
                      </span>
                      <span
                        className={`rounded-full border px-2 py-0.5 font-mono text-[9px] uppercase tracking-wide ${STATUS_PILL[stage.status]}`}
                      >
                        {stage.status}
                      </span>
                    </span>
                    <div className="flex flex-wrap gap-1.5">
                      {STAGE_ACTIONS.map((action) => (
                        <button
                          key={action}
                          type="button"
                          disabled={stage.status === action}
                          onClick={() => {
                            void changeStage(stage.stage, action);
                          }}
                          className="rounded-lg border border-white/10 bg-[#15191E] px-2.5 py-1 font-mono text-[10px] font-semibold text-slate-300 transition-colors hover:border-indigo-500/40 hover:text-white disabled:cursor-not-allowed disabled:opacity-40"
                        >
                          {action}
                        </button>
                      ))}
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </article>
        )}
      </section>
    </div>
  );
}
