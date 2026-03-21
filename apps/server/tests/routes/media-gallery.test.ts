import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import { errorHandler } from '../../src/shared/errors.js';
import { createTestUser } from '../factories/user.js';
import { createTestMediaCapture } from '../factories/media-capture.js';

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

const mockFindByFirebaseUid = vi.fn();
vi.mock('../../src/persistence/user-repository.js', () => ({
  findByFirebaseUid: mockFindByFirebaseUid,
}));

const mockFindAllByUserId = vi.fn();
vi.mock('../../src/persistence/media-repository.js', () => ({
  findAllByUserId: mockFindAllByUserId,
}));

const mockGenerateDownloadUrl = vi.fn();
class MockStorageUnavailableError extends Error {
  readonly code = 'STORAGE_UNAVAILABLE';
  constructor() { super('Firebase Storage not configured'); this.name = 'StorageUnavailableError'; }
}
vi.mock('../../src/services/media-storage.js', () => ({
  generateDownloadUrl: mockGenerateDownloadUrl,
  StorageUnavailableError: MockStorageUnavailableError,
}));

describe('GET /api/users/me/media', () => {
  let app: ReturnType<typeof Fastify>;
  const testUser = createTestUser({ id: 'user-1', display_name: 'Test User' });

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.setErrorHandler(errorHandler);

    // Register schema files
    await import('../../src/shared/schemas/common-schemas.js');
    await import('../../src/shared/schemas/media-gallery-schemas.js');

    const { mediaGalleryRoutes } = await import('../../src/routes/media-gallery.js');
    await app.register(mediaGalleryRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  function setupAuth() {
    mockVerifyFirebaseToken.mockResolvedValue({ uid: 'fb-uid-1' });
    mockFindByFirebaseUid.mockResolvedValue(testUser);
  }

  it('returns captures for authenticated user', async () => {
    setupAuth();
    const capture1 = createTestMediaCapture({ user_id: 'user-1', session_id: 'session-1' });
    const capture2 = createTestMediaCapture({ user_id: 'user-1', session_id: 'session-2' });
    mockFindAllByUserId.mockResolvedValue({
      captures: [
        { ...capture1, venue_name: 'Rock Bar', session_created_at: new Date('2026-01-01T20:00:00Z') },
        { ...capture2, venue_name: null, session_created_at: new Date('2026-01-02T20:00:00Z') },
      ],
      total: 2,
    });
    mockGenerateDownloadUrl.mockResolvedValue({ url: 'https://storage.example.com/signed-url' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me/media',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    const data = body['data'] as Record<string, unknown>;
    const captures = data['captures'] as Array<Record<string, unknown>>;
    expect(captures).toHaveLength(2);
    expect(data['total']).toBe(2);
    expect(captures[0]!['id']).toBe(capture1.id);
    expect(captures[0]!['sessionId']).toBe('session-1');
    expect(captures[0]!['venueName']).toBe('Rock Bar');
    expect(captures[0]!['url']).toBe('https://storage.example.com/signed-url');
    expect(captures[0]!['triggerType']).toBe('manual');
    expect(captures[0]!['createdAt']).toBeDefined();
    expect(captures[0]!['sessionDate']).toBeDefined();
    expect(captures[1]!['venueName']).toBeNull();
  });

  it('returns empty array for user with no captures', async () => {
    setupAuth();
    mockFindAllByUserId.mockResolvedValue({ captures: [], total: 0 });

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me/media',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    const data = body['data'] as Record<string, unknown>;
    expect(data['captures']).toEqual([]);
    expect(data['total']).toBe(0);
  });

  it('respects pagination (limit + offset)', async () => {
    setupAuth();
    const captures = Array.from({ length: 2 }, () => {
      const c = createTestMediaCapture({ user_id: 'user-1' });
      return { ...c, venue_name: 'Bar', session_created_at: new Date('2026-01-01T20:00:00Z') };
    });
    mockFindAllByUserId.mockResolvedValue({ captures, total: 5 });
    mockGenerateDownloadUrl.mockResolvedValue({ url: 'https://storage.example.com/signed-url' });

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me/media?limit=2&offset=2',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    expect(mockFindAllByUserId).toHaveBeenCalledWith('user-1', 2, 2);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    const data = body['data'] as Record<string, unknown>;
    expect(data['total']).toBe(5);
  });

  it('returns 401 without auth token', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me/media',
    });

    expect(response.statusCode).toBe(401);
  });

  it('handles storage unavailability gracefully (url: null)', async () => {
    setupAuth();
    const capture = createTestMediaCapture({ user_id: 'user-1' });
    mockFindAllByUserId.mockResolvedValue({
      captures: [{ ...capture, venue_name: 'Bar', session_created_at: new Date('2026-01-01T20:00:00Z') }],
      total: 1,
    });
    mockGenerateDownloadUrl.mockRejectedValue(new MockStorageUnavailableError());

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me/media',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    const data = body['data'] as Record<string, unknown>;
    const captures = data['captures'] as Array<Record<string, unknown>>;
    expect(captures[0]!['url']).toBeNull();
  });

  it('uses default pagination values', async () => {
    setupAuth();
    mockFindAllByUserId.mockResolvedValue({ captures: [], total: 0 });

    await app.inject({
      method: 'GET',
      url: '/api/users/me/media',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(mockFindAllByUserId).toHaveBeenCalledWith('user-1', 40, 0);
  });
});
