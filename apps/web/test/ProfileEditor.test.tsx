import { describe, it, expect, vi, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import ProfileEditor from '../src/components/ProfileEditor';

const mockUpdateProfile = vi.fn().mockResolvedValue({});

vi.mock('../src/context/AuthContext', () => ({
  useAuth: () => ({
    authEnabled: true,
    loading: false,
    session: null,
    user: { id: 'user-1', email: 'ramiro@example.com' },
    profile: {
      id: 'user-1',
      email: 'ramiro@example.com',
      display_name: 'Ramiro',
      avatar_url: null,
    },
    profileLoading: false,
    refreshProfile: vi.fn(),
    updateProfile: mockUpdateProfile,
    signIn: vi.fn(),
    signUp: vi.fn(),
    signOut: vi.fn(),
  }),
}));

afterEach(() => {
  vi.clearAllMocks();
});

describe('ProfileEditor', () => {
  it('renders profile fields and submits save', async () => {
    render(<ProfileEditor />);

    expect(screen.getByText('Mi perfil')).toBeInTheDocument();
    expect(screen.getByDisplayValue('ramiro@example.com')).toBeDisabled();
    expect(screen.getByDisplayValue('Ramiro')).toBeInTheDocument();

    fireEvent.click(screen.getByRole('button', { name: /Guardar perfil/i }));

    await waitFor(() => {
      expect(mockUpdateProfile).toHaveBeenCalledTimes(1);
    });
    expect(mockUpdateProfile).toHaveBeenCalledWith({
      display_name: 'Ramiro',
      avatar_url: '',
    });
  });
});
