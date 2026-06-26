import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { App } from '../src/App';

describe('App', () => {
  it('renders the studio title and subtitle', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { level: 1, name: 'Creator AI Studio' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('YouTube Christian Bible Channel Production System'),
    ).toBeInTheDocument();
  });

  it('renders the empty Episodes section', () => {
    render(<App />);

    expect(
      screen.getByRole('heading', { level: 2, name: 'Episodes' }),
    ).toBeInTheDocument();
    expect(screen.getByText('No episodes created yet')).toBeInTheDocument();
  });
});
