import { beforeAll, describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import IdeasView from '../src/components/IdeasView';

vi.mock('../src/api', () => ({
  fetchIdeas: vi.fn(),
  createIdea: vi.fn(),
  brainstormIdea: vi.fn(),
  approveIdeaProposal: vi.fn(),
  discardIdeaProposal: vi.fn(),
  deleteIdea: vi.fn(),
}));

import {
  fetchIdeas,
  createIdea,
  brainstormIdea,
  approveIdeaProposal,
  discardIdeaProposal,
} from '../src/api';

const mockedFetchIdeas = vi.mocked(fetchIdeas);
const mockedCreateIdea = vi.mocked(createIdea);
const mockedBrainstorm = vi.mocked(brainstormIdea);
const mockedApprove = vi.mocked(approveIdeaProposal);
const mockedDiscard = vi.mocked(discardIdeaProposal);

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = vi.fn();
});

describe('IdeasView', () => {
  it('renders ideation workspace in Spanish', async () => {
    mockedFetchIdeas.mockResolvedValueOnce([]);
    render(<IdeasView onOpenWorkspace={() => undefined} />);

    await waitFor(() => {
      expect(screen.getByText('Espacio de Ideas')).toBeInTheDocument();
    });
    expect(screen.getByPlaceholderText(/La fe de Rut en tiempos de crisis/i)).toBeTruthy();
    expect(screen.getByText('Guardar idea')).toBeInTheDocument();
  });

  it('creates idea and shows brainstorm proposals', async () => {
    mockedFetchIdeas.mockResolvedValueOnce([]);
    mockedCreateIdea.mockResolvedValueOnce({
      id: 'idea-1',
      rawIdea: 'Rut y Noemí',
      proposals: [],
      status: 'draft',
      createdAt: '2026-01-01T00:00:00.000Z',
      updatedAt: '2026-01-01T00:00:00.000Z',
    });
    mockedBrainstorm.mockResolvedValueOnce({
      idea: {
        id: 'idea-1',
        rawIdea: 'Rut y Noemí',
        proposals: [
          {
            id: 'p1',
            title: 'Rut: lealtad que cambia destinos',
            points: ['Gancho', 'Contexto', 'Aplicación'],
            status: 'pending',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        status: 'brainstormed',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      proposals: [],
    });

    render(<IdeasView onOpenWorkspace={() => undefined} />);

    fireEvent.change(screen.getByPlaceholderText(/La fe de Rut en tiempos de crisis/i), {
      target: { value: 'Rut y Noemí' },
    });
    fireEvent.click(screen.getByText('Guardar idea'));

    await waitFor(() => {
      expect(screen.getAllByText('Rut y Noemí').length).toBeGreaterThan(0);
    });

    await waitFor(() => {
      expect(screen.getByRole('button', { name: /Generar propuestas con IA/i })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: /Generar propuestas con IA/i }));

    await waitFor(() => {
      expect(screen.getByText(/Rut: lealtad que cambia destinos/i)).toBeInTheDocument();
    });
    expect(screen.getByText('Aprobar')).toBeInTheDocument();
    expect(screen.getByText('Descartar')).toBeInTheDocument();
  });

  it('approves proposal and shows production CTA', async () => {
    mockedFetchIdeas.mockResolvedValueOnce([
      {
        id: 'idea-2',
        rawIdea: 'Jonás',
        proposals: [
          {
            id: 'p2',
            title: 'Jonás: cuando huimos de Dios',
            points: ['Intro', 'Desarrollo'],
            status: 'pending',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        status: 'brainstormed',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
    ]);
    mockedApprove.mockResolvedValueOnce({
      idea: {
        id: 'idea-2',
        rawIdea: 'Jonás',
        proposals: [
          {
            id: 'p2',
            title: 'Jonás: cuando huimos de Dios',
            points: ['Intro', 'Desarrollo'],
            status: 'approved',
            createdAt: '2026-01-01T00:00:00.000Z',
          },
        ],
        status: 'approved',
        episodeId: 'ep-99',
        createdAt: '2026-01-01T00:00:00.000Z',
        updatedAt: '2026-01-01T00:00:00.000Z',
      },
      episodeId: 'ep-99',
      jobId: 'job-1',
      message: 'ok',
    });

    const onOpen = vi.fn();
    render(<IdeasView onOpenWorkspace={onOpen} />);

    await waitFor(() => {
      expect(screen.getAllByText('Jonás').length).toBeGreaterThan(0);
    });

    fireEvent.click(screen.getByText('Aprobar'));

    await waitFor(() => {
      expect(screen.getByText('Producción iniciada')).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText('Abrir workspace'));
    expect(onOpen).toHaveBeenCalledWith('ep-99');
    expect(mockedDiscard).not.toHaveBeenCalled();
  });
});
