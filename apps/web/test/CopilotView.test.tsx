import { beforeAll, describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import CopilotView from '../src/components/CopilotView';

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
});
