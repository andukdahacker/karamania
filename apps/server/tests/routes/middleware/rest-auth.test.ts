import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import { errorHandler } from '../../../src/shared/errors.js';
import { createTestUser } from '../../factories/user.js';

vi.mock('../../../src/config.js', () => ({
  config: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_SECRET: 'test-secret-key-at-least-32-characters-long',
    YOUTUBE_API_KEY: 'test-youtube-key',
    SPOTIFY_CLIENT_ID: 'test-id',
    SPOTIFY_CLIENT_SECRET: 'test-secret',
    FIREBASE_PROJECT_ID: 'test-project',
    FIREBASE_CLIENT_EMAIL: 'test@test.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: 'test-key',
    NODE_ENV: 'test',
    PORT: 3000,
  },
}));

vi.mock('../../../src/db/connection.js', () => ({
  db: {},
}));

vi.mock('../../../src/integrations/firebase-admin.js', () => ({
  verifyFirebaseToken: vi.fn(),
}));

vi.mock('../../../src/persistence/user-repository.js', () => ({
  findByFirebaseUid: vi.fn(),
}));

import { verifyFirebaseToken } from '../../../src/integrations/firebase-admin.js';
import { findByFirebaseUid } from '../../../src/persistence/user-repository.js';

const mockVerifyFirebase = vi.mocked(verifyFirebaseToken);
const mockFindByFirebaseUid = vi.mocked(findByFirebaseUid);

describe('REST auth middleware', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.setErrorHandler(errorHandler);
    const { userRoutes } = await import('../../../src/routes/users.js');
    await app.register(userRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('rejects request with no Authorization header → 401 AUTH_REQUIRED', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe('AUTH_REQUIRED');
    expect(body.error.message).toBe('Authentication required');
  });

  it('rejects request with invalid token → 401 AUTH_INVALID', async () => {
    mockVerifyFirebase.mockRejectedValue(new Error('Invalid token'));

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { authorization: 'Bearer invalid-token' },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe('AUTH_INVALID');
  });

  it('rejects request with valid Firebase token but no user record → 401 USER_NOT_FOUND', async () => {
    mockVerifyFirebase.mockResolvedValue({ uid: 'firebase-uid-123' } as never);
    mockFindByFirebaseUid.mockResolvedValue(undefined);

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe('USER_NOT_FOUND');
  });

  it('accepts valid Firebase token and attaches user to request context', async () => {
    const testUser = createTestUser({
      id: 'a0000000-0000-4000-a000-000000000010',
      firebase_uid: 'firebase-uid-123',
      display_name: 'Test User',
      avatar_url: 'https://example.com/avatar.png',
    });
    mockVerifyFirebase.mockResolvedValue({ uid: 'firebase-uid-123' } as never);
    mockFindByFirebaseUid.mockResolvedValue(testUser);

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(mockVerifyFirebase).toHaveBeenCalledWith('valid-token');
    expect(mockFindByFirebaseUid).toHaveBeenCalledWith('firebase-uid-123');
  });

  it('does not accept guest tokens (HS256) — rejects as AUTH_INVALID', async () => {
    // Guest tokens use HS256 symmetric signing (jose library).
    // verifyFirebaseToken only accepts RS256 Firebase JWTs, so guest tokens are rejected.
    mockVerifyFirebase.mockRejectedValue(new Error('Invalid token: wrong algorithm'));

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { authorization: 'Bearer eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJndWVzdC0xMjMiLCJzZXNzaW9uSWQiOiJzZXNzLTEiLCJyb2xlIjoiZ3Vlc3QifQ.fake' },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe('AUTH_INVALID');
    expect(mockVerifyFirebase).toHaveBeenCalled();
    // Crucially: findByFirebaseUid should NOT be called for guest tokens
    expect(mockFindByFirebaseUid).not.toHaveBeenCalled();
  });

  it('rejects request with malformed Authorization header', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { authorization: 'Basic some-token' },
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe('AUTH_REQUIRED');
  });
});
