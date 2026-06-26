import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import type { FastifyInstance } from 'fastify';
import { buildApp } from '../src/app.js';

describe('api routes', () => {
  let app: FastifyInstance;

  beforeAll(async () => {
    app = buildApp();
    await app.ready();
  });

  afterAll(async () => {
    await app.close();
  });

  it('GET /health returns the service status', async () => {
    const response = await app.inject({ method: 'GET', url: '/health' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({
      status: 'ok',
      service: 'creator-ai-studio-api',
    });
  });

  it('GET /episodes returns an empty list', async () => {
    const response = await app.inject({ method: 'GET', url: '/episodes' });

    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual([]);
  });
});
