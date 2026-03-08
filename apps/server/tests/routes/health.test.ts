import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';

// Mock config before any imports that use it
vi.mock('../../src/config.js', () => ({
  config: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_SECRET: 'test-secret-key-at-least-32-characters-long',
    YOUTUBE_API_KEY: 'test-key',
    SPOTIFY_CLIENT_ID: 'test-id',
    SPOTIFY_CLIENT_SECRET: 'test-secret',
    FIREBASE_PROJECT_ID: 'test-project',
    FIREBASE_CLIENT_EMAIL: 'test@test.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: 'test-key',
    NODE_ENV: 'test',
    PORT: 3000,
  },
}));

// Mock db connection
const mockExecute = vi.fn();
vi.mock('../../src/db/connection.js', () => ({
  db: {},
}));

// Mock kysely sql tagged template
vi.mock('kysely', async (importOriginal) => {
  const original = await importOriginal<typeof import('kysely')>();
  const sqlProxy = (..._args: unknown[]) => ({
    execute: mockExecute,
  });
  // Copy properties from original sql
  Object.setPrototypeOf(sqlProxy, Object.getPrototypeOf(original.sql));
  return {
    ...original,
    sql: sqlProxy,
  };
});

describe('GET /health', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    const { healthRoutes } = await import('../../src/routes/health.js');
    await app.register(healthRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns ok status when database is connected', async () => {
    mockExecute.mockResolvedValue({ rows: [{ '?column?': 1 }] });

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    expect(body).toHaveProperty('data');
    const data = body['data'] as Record<string, unknown>;
    expect(data['status']).toBe('ok');
    expect(data['database']).toBe('connected');
    expect(data['timestamp']).toBeDefined();
  });

  it('returns 503 when database is unreachable', async () => {
    mockExecute.mockRejectedValue(new Error('Connection refused'));

    const response = await app.inject({
      method: 'GET',
      url: '/health',
    });

    expect(response.statusCode).toBe(503);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    expect(body).toHaveProperty('error');
    const error = body['error'] as Record<string, unknown>;
    expect(error['code']).toBe('DATABASE_UNREACHABLE');
    expect(error['message']).toBe('Unable to connect to database');
  });
});
