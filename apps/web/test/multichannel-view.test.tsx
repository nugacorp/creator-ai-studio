import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import MultichannelView from '../src/components/MultichannelView';
import type { Channel } from '../src/types';

const sampleChannels: Channel[] = [
  {
    id: 'UC_one',
    name: 'Canal Principal',
    status: 'Produciendo',
    subscribers: 125_000,
    avatar: 'https://example.com/a.jpg',
    type: 'YouTube',
    customUrl: '@canal-principal',
  },
  {
    id: 'UC_two',
    name: 'Canal Secundario',
    status: 'Produciendo',
    subscribers: 4_200,
    avatar: 'https://example.com/b.jpg',
    type: 'YouTube',
  },
];

describe('MultichannelView', () => {
  it('shows connect prompt when YouTube is not connected', () => {
    const onGoToSettings = vi.fn();
    render(
      <MultichannelView
        channels={[]}
        youtubeConnected={false}
        loading={false}
        selectedChannelId={null}
        onSelectChannel={vi.fn()}
        onGoToSettings={onGoToSettings}
      />,
    );

    expect(screen.getByText('YouTube no conectado')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Ir a Integraciones/i }));
    expect(onGoToSettings).toHaveBeenCalled();
  });

  it('lists YouTube channels when connected', () => {
    render(
      <MultichannelView
        channels={sampleChannels}
        youtubeConnected
        loading={false}
        selectedChannelId="UC_one"
        onSelectChannel={vi.fn()}
        onGoToSettings={vi.fn()}
      />,
    );

    expect(screen.getByText('Canal Principal')).toBeInTheDocument();
    expect(screen.getByText('Canal Secundario')).toBeInTheDocument();
    expect(screen.getByText(/2 canales de YouTube/)).toBeInTheDocument();
    expect(screen.getByText('Activo')).toBeInTheDocument();
  });
});
