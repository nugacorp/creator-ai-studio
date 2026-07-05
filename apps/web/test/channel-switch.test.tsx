import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import Header from '../src/components/Header';
import { AuthProvider } from '../src/context/AuthContext';
import type { Channel } from '../src/types';

const channels: Channel[] = [
  {
    id: 'UC_one',
    name: 'Canal Principal',
    status: 'Produciendo',
    subscribers: 125_000,
    avatar: 'https://example.com/a.jpg',
    type: 'YouTube',
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

afterEach(() => {
  vi.restoreAllMocks();
});

describe('Header channel switch', () => {
  it('calls setSelectedChannel when picking a different channel', async () => {
    const onSelect = vi.fn();
    render(
      <AuthProvider>
        <Header
          channels={channels}
          selectedChannel={channels[0]}
          setSelectedChannel={onSelect}
          youtubeConnected
          channelsLoading={false}
          notifications={[]}
          setNotifications={vi.fn()}
        />
      </AuthProvider>,
    );

    fireEvent.click(screen.getByRole('button', { name: /Canal Principal/i }));
    fireEvent.click(screen.getByRole('button', { name: /Canal Secundario/i }));

    await waitFor(() => {
      expect(onSelect).toHaveBeenCalledWith(channels[1]);
    });
  });
});
