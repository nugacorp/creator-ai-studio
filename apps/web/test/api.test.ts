import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchEpisodes } from '../src/api';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('web API client', () => {
  it('uses /api as the default same-origin API base path', async () => {
    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse([]));

    await fetchEpisodes();

    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/episodes');
    expect(fetchMock.mock.calls[0]?.[1]).toEqual({ headers: expect.any(Headers) });
  });
});
