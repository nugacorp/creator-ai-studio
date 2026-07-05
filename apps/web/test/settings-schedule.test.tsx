import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { DEFAULT_PUBLISH_SCHEDULE } from '@creator-ai-studio/shared';
import SettingsView from '../src/components/SettingsView';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Settings publish schedule editor', () => {
  it('loads and displays publish schedule summary', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/settings')) {
        return jsonResponse({
          ttsSampleRate: '24000',
          ttsAccent: 'es-ES',
          aiProviderDefault: 'gemini',
          ttsProvider: 'elevenlabs',
          publishSchedule: DEFAULT_PUBLISH_SCHEDULE,
        });
      }
      if (url.includes('/secrets')) {
        return jsonResponse({ encryptionAvailable: false, items: [] });
      }
      return jsonResponse([]);
    });

    render(<SettingsView />);

    await waitFor(() =>
      expect(screen.getByText(/Video largo \(lun 15:00\)/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Shorts \(mar\/jue\/sáb 10:00\)/i)).toBeInTheDocument();
    expect(screen.getByText(/America\/Mexico_City/i)).toBeInTheDocument();
  });

  it('PATCHes publishSchedule when saving configuration', async () => {
    let patchBody: unknown;
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input, init) => {
      const url = String(input);
      const method = init?.method ?? 'GET';
      if (url.includes('/settings') && method === 'PATCH') {
        patchBody = JSON.parse(String(init?.body));
        return jsonResponse({
          ttsSampleRate: '24000',
          ttsAccent: 'es-ES',
          aiProviderDefault: 'gemini',
          ttsProvider: 'elevenlabs',
          publishSchedule: (patchBody as { publishSchedule: unknown }).publishSchedule,
        });
      }
      if (url.includes('/settings')) {
        return jsonResponse({
          ttsSampleRate: '24000',
          ttsAccent: 'es-ES',
          aiProviderDefault: 'gemini',
          ttsProvider: 'elevenlabs',
          publishSchedule: DEFAULT_PUBLISH_SCHEDULE,
        });
      }
      if (url.includes('/secrets')) {
        return jsonResponse({ encryptionAvailable: false, items: [] });
      }
      return jsonResponse([]);
    });

    render(<SettingsView />);
    await waitFor(() => expect(screen.getByText(/Horario habitual/i)).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Guardar configuración/i }));

    await waitFor(() => expect(patchBody).toBeTruthy());
    const schedule = (patchBody as { publishSchedule?: typeof DEFAULT_PUBLISH_SCHEDULE }).publishSchedule;
    expect(schedule?.longVideo.dayOfWeek).toBe(1);
    expect(schedule?.shorts?.daysOfWeek).toEqual([2, 4, 6]);
  });
});
