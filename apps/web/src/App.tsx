import {
  useCallback,
  useEffect,
  useState,
  type FormEvent,
  type ReactElement,
} from 'react';
import type { EpisodeSummary } from '@creator-ai-studio/shared';
import { createEpisode, fetchEpisodes } from './api';

export function App(): ReactElement {
  const [episodes, setEpisodes] = useState<EpisodeSummary[]>([]);
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
                {episode.title} — {episode.status}
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
