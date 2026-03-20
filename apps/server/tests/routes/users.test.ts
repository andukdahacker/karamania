import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import { errorHandler } from '../../src/shared/errors.js';
import { createTestUser } from '../factories/user.js';

vi.mock('../../src/config.js', () => ({
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

vi.mock('../../src/db/connection.js', () => ({
  db: {},
}));

vi.mock('../../src/integrations/firebase-admin.js', () => ({
  verifyFirebaseToken: vi.fn(),
}));

vi.mock('../../src/persistence/user-repository.js', () => ({
  findByFirebaseUid: vi.fn(),
}));

import { verifyFirebaseToken } from '../../src/integrations/firebase-admin.js';
import { findByFirebaseUid } from '../../src/persistence/user-repository.js';

const mockVerifyFirebase = vi.mocked(verifyFirebaseToken);
const mockFindByFirebaseUid = vi.mocked(findByFirebaseUid);

describe('GET /api/users/me', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.setErrorHandler(errorHandler);
    const { userRoutes } = await import('../../src/routes/users.js');
    await app.register(userRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns user profile with correct camelCase fields', async () => {
    const testUser = createTestUser({
      id: 'a0000000-0000-4000-a000-000000000001',
      display_name: 'Ducdo',
      avatar_url: 'https://example.com/avatar.png',
      created_at: new Date('2026-01-15T10:30:00Z'),
    });
    mockVerifyFirebase.mockResolvedValue({ uid: testUser.firebase_uid! } as never);
    mockFindByFirebaseUid.mockResolvedValue(testUser);

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toEqual({
      id: testUser.id,
      displayName: 'Ducdo',
      avatarUrl: 'https://example.com/avatar.png',
      createdAt: '2026-01-15T10:30:00.000Z',
    });
  });

  it('returns 401 when not authenticated', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe('AUTH_REQUIRED');
  });

  it('returns avatarUrl as null when user has no avatar', async () => {
    const testUser = createTestUser({
      id: 'a0000000-0000-4000-a000-000000000002',
      avatar_url: null,
    });
    mockVerifyFirebase.mockResolvedValue({ uid: testUser.firebase_uid! } as never);
    mockFindByFirebaseUid.mockResolvedValue(testUser);

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.avatarUrl).toBeNull();
  });

  it('returns createdAt as ISO 8601 string format', async () => {
    const testDate = new Date('2026-03-20T14:00:00Z');
    const testUser = createTestUser({
      id: 'a0000000-0000-4000-a000-000000000003',
      created_at: testDate,
    });
    mockVerifyFirebase.mockResolvedValue({ uid: testUser.firebase_uid! } as never);
    mockFindByFirebaseUid.mockResolvedValue(testUser);

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.createdAt).toBe('2026-03-20T14:00:00.000Z');
    // Verify it's parseable as ISO 8601
    expect(new Date(body.data.createdAt).toISOString()).toBe(body.data.createdAt);
  });
});
