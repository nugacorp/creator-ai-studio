import { describe, it, expect, afterEach } from 'vitest';
import { areMocksAllowed } from '../src/config/mocks.js';

describe('mock policy (FASE 8)', () => {
  const origNodeEnv = process.env.NODE_ENV;
  const origAllowMocks = process.env.ALLOW_MOCKS;

  afterEach(() => {
    process.env.NODE_ENV = origNodeEnv;
    if (origAllowMocks === undefined) delete process.env.ALLOW_MOCKS;
    else process.env.ALLOW_MOCKS = origAllowMocks;
  });

  it('blocks mocks when ALLOW_MOCKS=false', () => {
    process.env.ALLOW_MOCKS = 'false';
    process.env.NODE_ENV = 'development';
    expect(areMocksAllowed()).toBe(false);
  });

  it('blocks mocks in production when ALLOW_MOCKS unset', () => {
    delete process.env.ALLOW_MOCKS;
    process.env.NODE_ENV = 'production';
    expect(areMocksAllowed()).toBe(false);
  });

  it('allows mocks in development when unset', () => {
    delete process.env.ALLOW_MOCKS;
    process.env.NODE_ENV = 'development';
    expect(areMocksAllowed()).toBe(true);
  });
});
