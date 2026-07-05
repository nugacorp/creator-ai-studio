import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import AgentStudioView from '../src/components/AgentStudioView';

function jsonResponse(data: unknown, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json' },
  });
}

const agentsList = {
  orchestrator: 'hermes',
  agents: [
    {
      id: 'shorts_agent',
      name: 'Agente de Shorts',
      role: 'Shorts Agent',
      description: 'Identifica momentos virales',
      episodeStage: 'shorts',
      expertise: ['Shorts'],
      allowedJobTypes: ['agent', 'shorts'],
      status: 'active',
    },
    {
      id: 'hermes',
      name: 'Hermes',
      role: 'Orquestador',
      description: 'Planifica el episodio',
      episodeStage: 'planning',
      expertise: ['planificación'],
      allowedJobTypes: ['agent'],
      status: 'active',
    },
  ],
};

afterEach(() => {
  vi.restoreAllMocks();
});

describe('AgentStudioView', () => {
  it('lists shorts_agent and loads its config', async () => {
    vi.spyOn(globalThis, 'fetch').mockImplementation(async (input) => {
      const url = String(input);
      if (url.includes('/agents/shorts_agent/config')) {
        return jsonResponse({
          ...agentsList.agents[0],
          systemPrompt: 'Eres el agente de Shorts',
          skills: ['Shorts'],
          baseSkills: ['Shorts'],
          overrides: {},
        });
      }
      if (url.endsWith('/agents') || url.includes('/agents?')) {
        return jsonResponse(agentsList);
      }
      return jsonResponse([]);
    });

    render(<AgentStudioView />);

    await waitFor(() =>
      expect(screen.getByRole('button', { name: /Agente de Shorts/i })).toBeInTheDocument(),
    );

    fireEvent.click(screen.getByRole('button', { name: /Agente de Shorts/i }));

    await waitFor(() =>
      expect(screen.getByText(/Eres el agente de Shorts/i)).toBeInTheDocument(),
    );
    expect(screen.getByText(/Kanban · Edición/i)).toBeInTheDocument();
  });
});
