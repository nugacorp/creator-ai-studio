import { describe, expect, it, vi, afterEach } from 'vitest';
import { fetchEpisodes } from '../src/api';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(async () => {
  vi.restoreAllMocks();
  const { setApiAccessToken } = await import('../src/api');
  setApiAccessToken(null);
});

describe('web API client', () => {
  it('attaches Authorization when an access token is set', async () => {
    const { setApiAccessToken, fetchEpisodes } = await import('../src/api');
    setApiAccessToken('test-jwt-token');

    const fetchMock = vi
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(jsonResponse([]));

    await fetchEpisodes();

    const headers = fetchMock.mock.calls[0]?.[1]?.headers as Headers;
    expect(headers.get('Authorization')).toBe('Bearer test-jwt-token');
  });
});
