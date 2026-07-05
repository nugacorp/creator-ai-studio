import { beforeAll, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CopilotView from '../src/components/CopilotView';

vi.mock('../src/api', () => ({
  fetchCopilotMessages: vi.fn(),
  copilotChat: vi.fn(),
  copilotConfirmAction: vi.fn(),
}));

import { fetchCopilotMessages, copilotChat } from '../src/api';

const mockedFetch = vi.mocked(fetchCopilotMessages);
const mockedChat = vi.mocked(copilotChat);

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('CopilotView', () => {
  it('communicates project-only scope and loads persistent history', async () => {
    mockedFetch.mockResolvedValueOnce({
      welcome: 'Bienvenido al copiloto',
      messages: [
        {
          id: '1',
          role: 'user',
          content: 'Lista episodios',
          createdAt: new Date().toISOString(),
        },
        {
          id: '2',
          role: 'assistant',
          content: 'Tienes 1 episodio activo.',
          createdAt: new Date().toISOString(),
        },
      ],
    });

    render(<CopilotView channelId="ch-1" />);

    await waitFor(() => {
      expect(screen.getByText('Lista episodios')).toBeInTheDocument();
    });
    expect(screen.getByText('Tienes 1 episodio activo.')).toBeInTheDocument();
    expect(screen.getByText('Copiloto Inteligente de Creator OS')).toBeInTheDocument();
    expect(screen.getByText(/Centro de comando/i)).toBeInTheDocument();
  });

  it('shows a styled refusal when the API returns out_of_scope', async () => {
    mockedFetch.mockResolvedValueOnce({ welcome: 'Hola', messages: [] });
    mockedChat.mockResolvedValueOnce({
      reply:
        'Soy el copiloto de Creator AI Studio y no puedo responder consultas fuera del proyecto.',
      out_of_scope: true,
    });

    render(<CopilotView episodeTitle="David vs Goliat" />);

    await waitFor(() => {
      expect(screen.getByPlaceholderText(/Pide crear un episodio/i)).toBeEnabled();
    });

    fireEvent.change(screen.getByPlaceholderText(/Pide crear un episodio/i), {
      target: { value: 'cuanto es 4+9?' },
    });
    fireEvent.submit(screen.getByPlaceholderText(/Pide crear un episodio/i).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/Fuera del alcance del copiloto/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/no puedo responder consultas fuera del proyecto/i)).toBeInTheDocument();
  });
});
