import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import AutomationView from '../src/components/AutomationView';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AutomationView', () => {
  it('shows launch actions for the selected episode when backend data is available', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async input => {
      const url = String(input);
      if (url.includes('/system/mode')) {
        return jsonResponse({ demoMode: false, aiProvider: 'gemini', ttsConfigured: true, ffmpegAvailable: true });
      }
      if (url.includes('/system/storage')) {
        return jsonResponse({
          activeEpisodeCount: 1,
          maxActiveEpisodes: 3,
          archiveConfigured: true,
          ffmpegAvailable: true,
          piperAvailable: true,
          diskWarning: false,
        });
      }
      if (url.includes('/jobs')) {
        return jsonResponse({ jobs: [], summary: { pending: 0, active: 0, completed: 0, failed: 0 } });
      }
      return jsonResponse([]);
    });

    render(<AutomationView activeEpisodeId="ep-1" />);

    await waitFor(() => expect(screen.getAllByText(/Pipeline seguro/i).length).toBeGreaterThan(0));
    expect(screen.getAllByRole('button', { name: /ejecutar pipeline/i }).length).toBeGreaterThan(0);
  });
});
