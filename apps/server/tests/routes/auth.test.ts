import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import { createTestSession } from '../factories/session.js';

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

const mockFindByPartyCode = vi.fn();
vi.mock('../../src/persistence/session-repository.js', () => ({
  findByPartyCode: mockFindByPartyCode,
}));

vi.mock('../../src/db/connection.js', () => ({
  db: {},
}));

describe('POST /api/auth/guest', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    const { authRoutes } = await import('../../src/routes/auth.js');
    await app.register(authRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns 200 with token and guestId for valid request', async () => {
    const testSession = createTestSession({ party_code: 'VIBE', status: 'lobby' });
    mockFindByPartyCode.mockResolvedValue(testSession);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/guest',
      payload: { displayName: 'TestUser', partyCode: 'VIBE' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    expect(body).toHaveProperty('data');
    const data = body['data'] as Record<string, unknown>;
    expect(data['token']).toBeDefined();
    expect(typeof data['token']).toBe('string');
    expect(data['guestId']).toBeDefined();
    expect(typeof data['guestId']).toBe('string');
  });

  it('returns 404 for invalid partyCode', async () => {
    mockFindByPartyCode.mockResolvedValue(undefined);

    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/guest',
      payload: { displayName: 'TestUser', partyCode: 'NOPE' },
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    expect(body).toHaveProperty('error');
    const error = body['error'] as Record<string, unknown>;
    expect(error['code']).toBe('NOT_FOUND');
  });

  it('returns 400 for missing displayName', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/guest',
      payload: { partyCode: 'VIBE' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('returns 400 for empty displayName', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/guest',
      payload: { displayName: '', partyCode: 'VIBE' },
    });

    expect(response.statusCode).toBe(400);
  });
});
