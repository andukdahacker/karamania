import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import { createTestUser } from '../factories/user.js';
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

vi.mock('../../src/db/connection.js', () => ({
  db: {},
}));

const mockVerifyFirebaseToken = vi.fn();
vi.mock('../../src/integrations/firebase-admin.js', () => ({
  verifyFirebaseToken: mockVerifyFirebaseToken,
}));

const mockUpsertFromFirebase = vi.fn();
const mockCreateGuestUser = vi.fn();
vi.mock('../../src/persistence/user-repository.js', () => ({
  upsertFromFirebase: mockUpsertFromFirebase,
  createGuestUser: mockCreateGuestUser,
}));

const mockCreateSession = vi.fn();
vi.mock('../../src/services/session-manager.js', () => ({
  createSession: mockCreateSession,
}));

const mockGenerateGuestToken = vi.fn();
vi.mock('../../src/services/guest-token.js', () => ({
  generateGuestToken: mockGenerateGuestToken,
}));

describe('POST /api/sessions', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    const { sessionRoutes } = await import('../../src/routes/sessions.js');
    await app.register(sessionRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('with Firebase Bearer token returns 201 with sessionId and partyCode (no token/guestId)', async () => {
    const testUser = createTestUser({ id: 'firebase-user-1', display_name: 'Firebase User' });
    mockVerifyFirebaseToken.mockResolvedValue({
      uid: 'fb-uid-1',
      name: 'Firebase User',
      email: 'test@test.com',
      picture: 'https://example.com/avatar.jpg',
    });
    mockUpsertFromFirebase.mockResolvedValue(testUser);
    mockCreateSession.mockResolvedValue({ sessionId: 'session-1', partyCode: 'ABCD' });

    const response = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: {
        authorization: 'Bearer valid-firebase-token',
      },
      payload: {},
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    const data = body['data'] as Record<string, unknown>;
    expect(data['sessionId']).toBe('session-1');
    expect(data['partyCode']).toBe('ABCD');
    expect(data['token']).toBeUndefined();
    expect(data['guestId']).toBeUndefined();
  });

  it('with displayName (no auth) returns 201 with sessionId, partyCode, token, guestId', async () => {
    const guestUser = { ...createTestUser({ display_name: 'Host' }), firebase_uid: null };
    mockCreateGuestUser.mockResolvedValue(guestUser);
    mockCreateSession.mockResolvedValue({ sessionId: 'session-2', partyCode: 'EFGH' });
    mockGenerateGuestToken.mockResolvedValue('guest-jwt-token');

    const response = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { displayName: 'Host' },
    });

    expect(response.statusCode).toBe(201);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    const data = body['data'] as Record<string, unknown>;
    expect(data['sessionId']).toBe('session-2');
    expect(data['partyCode']).toBe('EFGH');
    expect(data['token']).toBe('guest-jwt-token');
    expect(data['guestId']).toBe(guestUser.id);
  });

  it('with no auth and no displayName returns 400', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: {},
    });

    expect(response.statusCode).toBe(400);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    expect(body).toHaveProperty('error');
    const error = body['error'] as Record<string, unknown>;
    expect(error['code']).toBe('BAD_REQUEST');
  });

  it('with invalid Firebase token returns error', async () => {
    mockVerifyFirebaseToken.mockRejectedValue(new Error('Invalid token'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      headers: {
        authorization: 'Bearer invalid-token',
      },
      payload: {},
    });

    expect(response.statusCode).toBe(500);
  });

  it('with vibe rock creates session with vibe rock', async () => {
    const guestUser = { ...createTestUser({ display_name: 'Host' }), firebase_uid: null };
    mockCreateGuestUser.mockResolvedValue(guestUser);
    mockCreateSession.mockResolvedValue({ sessionId: 'session-3', partyCode: 'ROCK' });
    mockGenerateGuestToken.mockResolvedValue('guest-jwt-token');

    const response = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { displayName: 'Host', vibe: 'rock' },
    });

    expect(response.statusCode).toBe(201);
    expect(mockCreateSession).toHaveBeenCalledWith(
      expect.objectContaining({ vibe: 'rock' })
    );
  });

  it('with invalid vibe returns 400 validation error', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/sessions',
      payload: { displayName: 'Host', vibe: 'invalid-vibe' },
    });

    expect(response.statusCode).toBe(400);
  });
});
