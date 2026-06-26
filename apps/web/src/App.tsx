import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactElement,
} from 'react';
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
} from './api';

const STAGE_ACTIONS: EpisodeStageStatus[] = [
  'in_progress',
  'completed',
  'blocked',
];

export function App(): ReactElement {
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
    <main>
      <h1>Creator AI Studio</h1>
      <p>YouTube Christian Bible Channel Production System</p>

      <section>
        <h2>Create Episode</h2>
        <form onSubmit={handleSubmit}>
          <label htmlFor="episode-title">Title</label>
          <input
            id="episode-title"
            name="title"
            value={title}
            placeholder="Episode title"
            onChange={(event) => setTitle(event.target.value)}
          />
          <button type="submit" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create episode'}
          </button>
        </form>
      </section>

      <section>
        <h2>Episodes</h2>
        {error !== null ? <p role="alert">{error}</p> : null}
        {loading ? (
          <p>Loading episodes…</p>
        ) : episodes.length === 0 ? (
          <p>No episodes created yet</p>
        ) : (
          <ul>
            {episodes.map((episode) => (
              <li key={episode.id}>
                <button
                  type="button"
                  aria-pressed={episode.id === selectedId}
                  onClick={() => {
                    void selectEpisode(episode.id);
                  }}
                >
                  {episode.title} — {episode.status}
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Episode detail">
        <h2>Episode Detail</h2>
        {selectedId === null ? (
          <p>No episode selected</p>
        ) : detailLoading ? (
          <p>Loading detail…</p>
        ) : detail === null ? (
          <p>No episode selected</p>
        ) : (
          <article>
            <h3>{detail.title}</h3>
            <p>Status: {detail.status}</p>
            <p>Workspace: {detail.workspacePath}</p>
            <h4>Stages</h4>
            <ol>
              {detail.stages.map((stage) => (
                <li key={stage.stage}>
                  <span>
                    {stage.stage}: {stage.status}
                  </span>
                  {STAGE_ACTIONS.map((action) => (
                    <button
                      key={action}
                      type="button"
                      disabled={stage.status === action}
                      onClick={() => {
                        void changeStage(stage.stage, action);
                      }}
                    >
                      {action}
                    </button>
                  ))}
                </li>
              ))}
            </ol>
          </article>
        )}
      </section>
    </main>
  );
}
