import process from 'node:process';

/**
 * FASE 8 — central mock/demo policy.
 *
 * - `ALLOW_MOCKS=true`  → mocks allowed (dev only; never set in production).
 * - `ALLOW_MOCKS=false` → mocks blocked everywhere (recommended for staging).
 * - unset               → allowed only in NODE_ENV=development or test.
 *                         Blocked in production and staging (NODE_ENV=production).
 *
 * "Mocks" covers: demo AI provider fallback, silent demo TTS responses, and
 * fake YouTube analytics numbers.
 */
export function areMocksAllowed(): boolean {
  const flag = process.env.ALLOW_MOCKS;
  if (flag === 'true' || flag === '1') return true;
  if (flag === 'false' || flag === '0') return false;
  const env = process.env.NODE_ENV ?? 'development';
  return env === 'development' || env === 'test';
}
