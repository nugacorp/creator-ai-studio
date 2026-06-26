import type { ReactElement } from 'react';
import type { EpisodeSummary } from '@creator-ai-studio/shared';

// MVP skeleton: no episodes are produced yet. No real content, no API calls.
const episodes: EpisodeSummary[] = [];

export function App(): ReactElement {
  return (
    <main>
      <h1>Creator AI Studio</h1>
      <p>YouTube Christian Bible Channel Production System</p>

      <section>
        <h2>Episodes</h2>
        {episodes.length === 0 ? (
          <p>No episodes created yet</p>
        ) : (
          <ul>
            {episodes.map((episode) => (
              <li key={episode.id}>{episode.title}</li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}
