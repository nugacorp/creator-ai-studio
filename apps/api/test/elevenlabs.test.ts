import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  ELEVENLABS_DEFAULT_MODEL_ID,
  ELEVENLABS_DEFAULT_VOICE_ID,
  ElevenLabsApiError,
  listElevenLabsVoices,
  synthesizeSpeech,
} from '../src/integrations/elevenlabs.js';

describe('elevenlabs integration', () => {
  const fetchMock = vi.fn();

  beforeEach(() => {
    vi.stubGlobal('fetch', fetchMock);
    delete process.env.ELEVENLABS_API_KEY;
    delete process.env.ELEVENLABS_VOICE_ID;
    delete process.env.ELEVENLABS_MODEL_ID;
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    fetchMock.mockReset();
  });

  it('returns demo mode when API key is missing', async () => {
    const result = await synthesizeSpeech('Hola mundo');
    expect(result).toEqual({ audioUrl: '', isDemo: true });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('calls text-to-speech with current API shape', async () => {
    process.env.ELEVENLABS_API_KEY = 'xi-test-key';
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('fake-mp3'),
    });

    const result = await synthesizeSpeech('Hola mundo');

    expect(fetchMock).toHaveBeenCalledOnce();
    const [url, init] = fetchMock.mock.calls[0] as [URL, RequestInit];
    expect(String(url)).toBe(
      `https://api.elevenlabs.io/v1/text-to-speech/${ELEVENLABS_DEFAULT_VOICE_ID}?output_format=mp3_44100_128`,
    );
    expect(init.method).toBe('POST');
    expect(JSON.parse(String(init.body))).toEqual({
      text: 'Hola mundo',
      model_id: ELEVENLABS_DEFAULT_MODEL_ID,
    });
    expect(result.isDemo).toBe(false);
  });

  it('strips screenplay markup before sending to ElevenLabs', async () => {
    process.env.ELEVENLABS_API_KEY = 'xi-test-key';
    fetchMock.mockResolvedValue({
      ok: true,
      arrayBuffer: async () => Buffer.from('fake-mp3'),
    });

    await synthesizeSpeech(`**[INTRO]**\n**Narrador:**\n"Solo esto se narra."`);

    const body = JSON.parse(String(fetchMock.mock.calls[0][1].body)) as { text: string };
    expect(body.text).toBe('Solo esto se narra.');
  });

  it('throws ElevenLabsApiError when the API rejects the request', async () => {
    process.env.ELEVENLABS_API_KEY = 'xi-test-key';
    fetchMock.mockResolvedValue({
      ok: false,
      status: 401,
      json: async () => ({ detail: { message: 'Invalid API key' } }),
    });

    await expect(synthesizeSpeech('Hola')).rejects.toBeInstanceOf(ElevenLabsApiError);
    await expect(synthesizeSpeech('Hola')).rejects.toThrow('Invalid API key');
  });

  it('lists voices from the v2 endpoint with pagination', async () => {
    process.env.ELEVENLABS_API_KEY = 'xi-test-key';
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          voices: [{ voice_id: 'voice-1', name: 'George', category: 'premade' }],
          has_more: true,
          next_page_token: 'page-2',
        }),
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          voices: [{ voice_id: 'voice-2', name: 'Helen', category: 'premade' }],
          has_more: false,
          next_page_token: null,
        }),
      });

    const voices = await listElevenLabsVoices();

    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(String(fetchMock.mock.calls[0][0])).toContain('/v2/voices');
    expect(String(fetchMock.mock.calls[1][0])).toContain('next_page_token=page-2');
    expect(voices).toEqual([
      { voiceId: 'voice-1', name: 'George', category: 'premade', previewUrl: undefined },
      { voiceId: 'voice-2', name: 'Helen', category: 'premade', previewUrl: undefined },
    ]);
  });
});
