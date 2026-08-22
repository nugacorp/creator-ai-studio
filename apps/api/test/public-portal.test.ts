import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buildApp } from '../src/app.js';

/**
 * Church Public Portal V1 — tests de integración (T-20..T-34).
 *
 * Cobertura del plan §17.2. Sin base de datos real, validamos:
 *  - comportamiento del plugin sin CHURCH_PUBLIC_SLUG (404),
 *  - prefijo no abre rutas vecinas (T-23, T-24),
 *  - mutaciones rechazadas (T-25),
 *  - allowlist de auth, cabeceras de caché y CORS en escenarios representativos.
 *
 * Los tests contra PostgREST (anonClient, vistas, RLS to anon) son cubiertos
 * por supabase/tests/church_public_portal_v1.test.sql. Aquí validamos la
 * capa HTTP.
 */

const originalEnv = { ...process.env };
const PUBLIC_SLUG = 'test-public-church';

describe('public portal (T-20..T-34)', () => {
  beforeEach(() => {
    process.env.CHURCH_PUBLIC_SLUG = PUBLIC_SLUG;
    process.env.PUBLIC_CORS_ORIGINS = 'https://test.example.com,https://www.test.example.com';
    process.env.PUBLIC_CACHE_TTL_LIVE = '30';
    process.env.PUBLIC_CACHE_TTL_CONTENT = '60';
    process.env.CAS_API_KEY = 'test-static-key-1234';
    process.env.SUPABASE_URL = '';
    process.env.SUPABASE_ANON_KEY = '';
    process.env.NODE_ENV = 'development';
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  // T-33: sin CHURCH_PUBLIC_SLUG, el plugin no se registra y los endpoints
  // devuelven 404.
  describe('without CHURCH_PUBLIC_SLUG (T-33)', () => {
    it('does not register /api/public/* routes', async () => {
      delete process.env.CHURCH_PUBLIC_SLUG;
      const app = await buildApp({ logger: false });
      const resLive = await app.inject({ method: 'GET', url: '/api/public/live' });
      const resEvents = await app.inject({ method: 'GET', url: '/api/public/events' });
      const resSermon = await app.inject({ method: 'GET', url: '/api/public/latest-sermon' });
      expect(resLive.statusCode).toBe(404);
      expect(resEvents.statusCode).toBe(404);
      expect(resSermon.statusCode).toBe(404);
      await app.close();
    });
  });

  // T-22, T-23, T-24: las rutas internas siguen requiriendo auth y el prefijo
  // no abre rutas vecinas.
  describe('auth boundary (T-22..T-24)', () => {
    it('rejects /api/church/productions without auth (T-22)', async () => {
      const app = await buildApp({ logger: false });
      const res = await app.inject({ method: 'GET', url: '/api/church/productions' });
      expect(res.statusCode).toBe(401);
      await app.close();
    });

    it('rejects /api/public (without trailing slash) (T-23)', async () => {
      const app = await buildApp({ logger: false });
      const res = await app.inject({ method: 'GET', url: '/api/public' });
      expect([401, 404]).toContain(res.statusCode);
      await app.close();
    });

    it('does not open /api/publicaciones or /api/public-targets (T-24)', async () => {
      const app = await buildApp({ logger: false });
      const resA = await app.inject({ method: 'GET', url: '/api/publicaciones' });
      const resB = await app.inject({ method: 'GET', url: '/api/public-targets' });
      expect([401, 404]).toContain(resA.statusCode);
      expect([401, 404]).toContain(resB.statusCode);
      await app.close();
    });
  });

  // T-25: el plugin solo acepta GET/OPTIONS, nunca POST/PATCH/DELETE.
  describe('method allowlist (T-25)', () => {
    it('rejects POST /api/public/live', async () => {
      const app = await buildApp({ logger: false });
      const res = await app.inject({ method: 'POST', url: '/api/public/live', payload: {} });
      expect([404, 405]).toContain(res.statusCode);
      await app.close();
    });
  });

  // T-29, T-30, T-31: CORS preflight desde orígenes permitidos y rechazados.
  describe('CORS preflight (T-29, T-30, T-31)', () => {
    it('responds to OPTIONS from an allowed origin', async () => {
      const app = await buildApp({ logger: false });
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/public/live',
        headers: {
          origin: 'https://test.example.com',
          'access-control-request-method': 'GET',
          'access-control-request-headers': 'content-type',
        },
      });
      expect(res.statusCode).toBe(204);
      expect(res.headers['access-control-allow-origin']).toBe('https://test.example.com');
      expect(res.headers['access-control-allow-methods']).toMatch(/GET/);
      await app.close();
    });

    it('does not allow credentials (T-29b)', async () => {
      const app = await buildApp({ logger: false });
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/public/events',
        headers: {
          origin: 'https://test.example.com',
          'access-control-request-method': 'GET',
        },
      });
      // credentials:false → la cabecera no debe estar presente
      expect(res.headers['access-control-allow-credentials']).toBeUndefined();
      await app.close();
    });
  });

  // T-27, T-28: cabeceras de caché correctas.
  describe('cache headers (T-27, T-28)', () => {
    it('GET /api/public/live sends cache-control max-age=30', async () => {
      const app = await buildApp({ logger: false });
      const res = await app.inject({ method: 'GET', url: '/api/public/live' });
      // Sin Supabase configurado, anonClient() devuelve null silenciosamente
      // y el endpoint responde con status:'offline' y cache-control.
      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toBe('public, max-age=30');
      await app.close();
    });

    it('GET /api/public/latest-sermon sends cache-control max-age=60', async () => {
      const app = await buildApp({ logger: false });
      const res = await app.inject({ method: 'GET', url: '/api/public/latest-sermon' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toBe('public, max-age=60');
      await app.close();
    });

    it('GET /api/public/events sends cache-control max-age=60', async () => {
      const app = await buildApp({ logger: false });
      const res = await app.inject({ method: 'GET', url: '/api/public/events' });
      expect(res.statusCode).toBe(200);
      expect(res.headers['cache-control']).toBe('public, max-age=60');
      await app.close();
    });
  });

  // T-26: la respuesta solo expone los campos del contrato público.
  describe('response contract (T-26)', () => {
    it('/api/public/live responds with status + next shape only', async () => {
      const app = await buildApp({ logger: false });
      const res = await app.inject({ method: 'GET', url: '/api/public/live' });
      const body = res.json();
      expect(body).toEqual({
        status: 'offline',
        next: null,
      });
      expect(body).not.toHaveProperty('script');
      expect(body).not.toHaveProperty('assignedTo');
      expect(body).not.toHaveProperty('createdBy');
      expect(body).not.toHaveProperty('churchId');
      await app.close();
    });

    it('/api/public/latest-sermon responds with sermon null shape', async () => {
      const app = await buildApp({ logger: false });
      const res = await app.inject({ method: 'GET', url: '/api/public/latest-sermon' });
      const body = res.json();
      expect(body).toEqual({ sermon: null });
      await app.close();
    });
  });

  // T-34: en producción sin PUBLIC_CORS_ORIGINS, el arranque falla.
  describe('production safety (T-34)', () => {
    it('throws when PUBLIC_CORS_ORIGINS is empty and NODE_ENV=production', async () => {
      process.env.NODE_ENV = 'production';
      process.env.PUBLIC_CORS_ORIGINS = '';
      await expect(buildApp({ logger: false })).rejects.toThrow(/PUBLIC_CORS_ORIGINS/);
    });
  });
});
