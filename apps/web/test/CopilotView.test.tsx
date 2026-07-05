import { beforeAll, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import CopilotView from '../src/components/CopilotView';

vi.mock('../src/api', () => ({
  aiChat: vi.fn(),
}));

import { aiChat } from '../src/api';

const mockedAiChat = vi.mocked(aiChat);

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('CopilotView', () => {
  it('communicates project-only scope and provider-neutral AI copy', () => {
    render(<CopilotView />);

    expect(screen.getByText('Copiloto Inteligente de Creator OS')).toBeInTheDocument();
    expect(
      screen.getByText(/solo responde sobre Creator AI Studio/i),
    ).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/pregunta solo sobre Creator AI Studio/i),
    ).toBeInTheDocument();
    expect(screen.queryByText(/Gemini 3\.5 Flash/i)).not.toBeInTheDocument();
    expect(
      screen.queryByPlaceholderText(/cualquier cosa/i),
    ).not.toBeInTheDocument();
  });

  it('shows a styled refusal when the API returns out_of_scope', async () => {
    mockedAiChat.mockResolvedValueOnce({
      reply:
        'Soy el copiloto de Creator AI Studio y no puedo responder consultas fuera del proyecto.',
      out_of_scope: true,
    });

    render(<CopilotView episodeTitle="David vs Goliat" />);

    fireEvent.change(
      screen.getByPlaceholderText(/pregunta solo sobre Creator AI Studio/i),
      { target: { value: 'cuanto es 4+9?' } },
    );
    fireEvent.submit(screen.getByPlaceholderText(/pregunta solo sobre Creator AI Studio/i).closest('form')!);

    await waitFor(() => {
      expect(screen.getByText(/Fuera del alcance del copiloto/i)).toBeInTheDocument();
    });
    expect(screen.getByText(/no puedo responder consultas fuera del proyecto/i)).toBeInTheDocument();
  });
});
