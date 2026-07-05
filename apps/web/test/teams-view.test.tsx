import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import TeamsView from '../src/components/TeamsView';

const mockFetchTeam = vi.fn();
const mockSyncTeamOwner = vi.fn();
const mockInviteTeamMember = vi.fn();

vi.mock('../src/api', () => ({
  fetchTeam: (...args: unknown[]) => mockFetchTeam(...args),
  syncTeamOwner: (...args: unknown[]) => mockSyncTeamOwner(...args),
  inviteTeamMember: (...args: unknown[]) => mockInviteTeamMember(...args),
  updateTeamMemberRole: vi.fn(),
  removeTeamMember: vi.fn(),
  revokeTeamInvite: vi.fn(),
}));

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    authEnabled: true,
    loading: false,
    session: null,
    user: { id: 'user-1', email: 'owner@studio.test', user_metadata: {} },
    profile: {
      id: 'user-1',
      email: 'owner@studio.test',
      display_name: 'Owner CAS',
      avatar_url: null,
    },
    profileLoading: false,
    refreshProfile: vi.fn(),
    updateProfile: vi.fn(),
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('TeamsView', () => {
  it('renders owner and pending invites from the API', async () => {
    mockFetchTeam.mockResolvedValue({
      ownerUserId: 'user-1',
      currentUserId: 'user-1',
      canManage: true,
      members: [
        {
          id: 'mem-1',
          userId: 'user-1',
          email: 'owner@studio.test',
          displayName: 'Owner CAS',
          role: 'owner',
          avatarInitial: 'O',
          joinedAt: '2026-07-05T00:00:00.000Z',
          lastActiveAt: '2026-07-05T00:00:00.000Z',
        },
      ],
      invites: [
        {
          id: 'inv-1',
          email: 'editor@studio.test',
          role: 'editor',
          invitedAt: '2026-07-05T00:00:00.000Z',
        },
      ],
    });
    mockSyncTeamOwner.mockImplementation(async () => ({
      ownerUserId: 'user-1',
      currentUserId: 'user-1',
      canManage: true,
      members: [
        {
          id: 'mem-1',
          userId: 'user-1',
          email: 'owner@studio.test',
          displayName: 'Owner CAS',
          role: 'owner',
          avatarInitial: 'O',
          joinedAt: '2026-07-05T00:00:00.000Z',
          lastActiveAt: '2026-07-05T00:00:00.000Z',
        },
      ],
      invites: [
        {
          id: 'inv-1',
          email: 'editor@studio.test',
          role: 'editor',
          invitedAt: '2026-07-05T00:00:00.000Z',
        },
      ],
    }));

    render(<TeamsView />);

    await waitFor(() => {
      expect(screen.getByText('Owner CAS')).toBeInTheDocument();
    });

    expect(screen.getByText('Propietario')).toBeInTheDocument();
    expect(screen.getByText('editor@studio.test')).toBeInTheDocument();
    expect(screen.getByText(/Invitaciones pendientes/i)).toBeInTheDocument();
    expect(screen.queryByText(/Online/i)).not.toBeInTheDocument();
  });

  it('opens invite modal and submits email invite', async () => {
    mockFetchTeam.mockResolvedValue({
      canManage: true,
      members: [
        {
          id: 'mem-1',
          email: 'owner@studio.test',
          displayName: 'Owner CAS',
          role: 'owner',
          avatarInitial: 'O',
          joinedAt: '2026-07-05T00:00:00.000Z',
        },
      ],
      invites: [],
    });
    mockSyncTeamOwner.mockImplementation(async () => mockFetchTeam());
    mockInviteTeamMember.mockResolvedValue({
      canManage: true,
      members: [
        {
          id: 'mem-1',
          email: 'owner@studio.test',
          displayName: 'Owner CAS',
          role: 'owner',
          avatarInitial: 'O',
          joinedAt: '2026-07-05T00:00:00.000Z',
        },
      ],
      invites: [
        {
          id: 'inv-2',
          email: 'nuevo@studio.test',
          role: 'viewer',
          invitedAt: '2026-07-05T01:00:00.000Z',
        },
      ],
    });

    render(<TeamsView />);

    await waitFor(() => expect(screen.getByText('Owner CAS')).toBeInTheDocument());

    fireEvent.click(screen.getByRole('button', { name: /Invitar Miembro/i }));
    fireEvent.change(screen.getByLabelText(/Correo electrónico/i), {
      target: { value: 'nuevo@studio.test' },
    });
    fireEvent.click(screen.getByLabelText(/Lector/i));
    fireEvent.click(screen.getByRole('button', { name: /Enviar invitación/i }));

    await waitFor(() => {
      expect(mockInviteTeamMember).toHaveBeenCalledWith({
        email: 'nuevo@studio.test',
        role: 'viewer',
      });
    });
  });
});
