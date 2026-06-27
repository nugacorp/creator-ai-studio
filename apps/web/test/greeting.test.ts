import { describe, it, expect } from 'vitest';
import { getTimeGreeting, resolveDisplayName } from '../src/lib/greeting';

describe('greeting', () => {
  it('returns buenos días in the morning', () => {
    expect(getTimeGreeting(new Date('2026-06-26T09:00:00'))).toBe('Buenos días');
  });

  it('returns buenas tardes in the afternoon', () => {
    expect(getTimeGreeting(new Date('2026-06-26T15:00:00'))).toBe('Buenas tardes');
  });

  it('returns buenas noches at night', () => {
    expect(getTimeGreeting(new Date('2026-06-26T22:00:00'))).toBe('Buenas noches');
  });

  it('prefers display name over email', () => {
    expect(
      resolveDisplayName({ displayName: 'Ramiro', email: 'ramiro@example.com' }),
    ).toBe('Ramiro');
  });

  it('falls back to email local part', () => {
    expect(resolveDisplayName({ email: 'ramiro@example.com' })).toBe('ramiro');
  });
});
