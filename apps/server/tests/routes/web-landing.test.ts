import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { webLandingRoutes } from '../../src/routes/web-landing.js';

describe('Web Landing Routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    app = Fastify();
    await app.register(webLandingRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('Static file serving', () => {
    it('GET / returns HTML with status 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/html');
      expect(response.body).toContain('KARAMANIA');
    });

    it('GET /style.css returns CSS with status 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/style.css',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('text/css');
      expect(response.body).toContain('--dj-bg');
    });

    it('GET /script.js returns JS with status 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/script.js',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/javascript');
      expect(response.body).toContain('attemptDeepLink');
    });
  });

  describe('Well-known files', () => {
    it('GET /.well-known/apple-app-site-association returns JSON with status 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/apple-app-site-association',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      const body = JSON.parse(response.body) as Record<string, unknown>;
      expect(body).toHaveProperty('applinks');
    });

    it('GET /.well-known/assetlinks.json returns JSON with status 200', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/.well-known/assetlinks.json',
      });

      expect(response.statusCode).toBe(200);
      expect(response.headers['content-type']).toContain('application/json');
      const body = JSON.parse(response.body) as Array<Record<string, unknown>>;
      expect(body[0]).toHaveProperty('relation');
      expect(body[0]).toHaveProperty('target');
    });
  });

  describe('API route precedence', () => {
    it('explicit routes take precedence over static serving', async () => {
      // Register a custom route BEFORE web landing static
      const precedenceApp = Fastify();
      precedenceApp.get('/api/test', async () => ({ status: 'ok' }));
      await precedenceApp.register(webLandingRoutes);
      await precedenceApp.ready();

      const response = await precedenceApp.inject({
        method: 'GET',
        url: '/api/test',
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      expect(body['status']).toBe('ok');
      await precedenceApp.close();
    });
  });
});
