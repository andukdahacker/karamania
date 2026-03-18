import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import { createTestMediaCapture } from '../factories/media-capture.js';
import { createTestSession } from '../factories/session.js';
import { errorHandler } from '../../src/shared/errors.js';

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
    FIREBASE_STORAGE_BUCKET: 'test-bucket.firebasestorage.app',
    NODE_ENV: 'test',
    PORT: 3000,
  },
}));

const mockCreate = vi.fn();
const mockFindBySessionId = vi.fn();
const mockFindById = vi.fn();
vi.mock('../../src/persistence/media-repository.js', () => ({
  create: (...args: unknown[]) => mockCreate(...args),
  findBySessionId: (...args: unknown[]) => mockFindBySessionId(...args),
  findById: (...args: unknown[]) => mockFindById(...args),
}));

const mockIsSessionParticipant = vi.fn();
const mockSessionFindById = vi.fn();
vi.mock('../../src/persistence/session-repository.js', () => ({
  isSessionParticipant: (...args: unknown[]) => mockIsSessionParticipant(...args),
  findById: (...args: unknown[]) => mockSessionFindById(...args),
}));

const mockGenerateUploadUrl = vi.fn();
const mockGenerateDownloadUrl = vi.fn();
const mockFileExists = vi.fn();
vi.mock('../../src/services/media-storage.js', () => ({
  generateUploadUrl: (...args: unknown[]) => mockGenerateUploadUrl(...args),
  generateDownloadUrl: (...args: unknown[]) => mockGenerateDownloadUrl(...args),
  fileExists: (...args: unknown[]) => mockFileExists(...args),
  getContentType: (path: string) => {
    const ext = path.split('.').pop()?.toLowerCase() ?? '';
    const map: Record<string, string> = { jpg: 'image/jpeg', mp4: 'video/mp4', m4a: 'audio/mp4' };
    return map[ext] ?? 'application/octet-stream';
  },
  StorageUnavailableError: class StorageUnavailableError extends Error {
    readonly code = 'STORAGE_UNAVAILABLE';
    constructor() { super('Firebase Storage not configured'); this.name = 'StorageUnavailableError'; }
  },
}));

// Mock auth helpers
const mockVerifyFirebaseToken = vi.fn();
vi.mock('../../src/integrations/firebase-admin.js', () => ({
  verifyFirebaseToken: (...args: unknown[]) => mockVerifyFirebaseToken(...args),
  getStorageBucket: vi.fn(),
}));

const mockVerifyGuestToken = vi.fn();
vi.mock('../../src/services/guest-token.js', () => ({
  verifyGuestToken: (...args: unknown[]) => mockVerifyGuestToken(...args),
}));

// Mock jose to control token header decoding
const mockDecodeProtectedHeader = vi.fn();
vi.mock('jose', () => ({
  decodeProtectedHeader: (...args: unknown[]) => mockDecodeProtectedHeader(...args),
}));

vi.mock('../../src/db/connection.js', () => ({
  db: {},
}));

function makeAuthenticatedHeader() {
  return { authorization: 'Bearer firebase-token-123' };
}

function makeGuestHeader() {
  return { authorization: 'Bearer guest-token-123' };
}

function setupFirebaseAuth(uid = 'user-1') {
  mockDecodeProtectedHeader.mockReturnValue({ kid: 'key-id', alg: 'RS256' });
  mockVerifyFirebaseToken.mockResolvedValue({ uid });
}

function setupGuestAuth(guestId = 'guest-1', sessionId = 'session-1') {
  mockDecodeProtectedHeader.mockReturnValue({ alg: 'HS256' });
  mockVerifyGuestToken.mockResolvedValue({ guestId, sessionId, role: 'guest' });
}

describe('Capture routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.setErrorHandler(errorHandler);
    const { captureRoutes } = await import('../../src/routes/captures.js');
    await app.register(captureRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/sessions/:sessionId/captures', () => {
    it('returns 201 with capture data for valid request', async () => {
      const capture = createTestMediaCapture();
      mockCreate.mockResolvedValue(capture);

      const response = await app.inject({
        method: 'POST',
        url: '/api/sessions/session-1/captures',
        payload: { captureType: 'photo', triggerType: 'manual' },
      });

      expect(response.statusCode).toBe(201);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      expect(body).toHaveProperty('data');
      const data = body['data'] as Record<string, unknown>;
      expect(data['id']).toBe(capture.id);
      expect(data['sessionId']).toBe(capture.session_id);
      expect(data['storagePath']).toBe(capture.storage_path);
      expect(data['triggerType']).toBe(capture.trigger_type);
      expect(data['createdAt']).toBeDefined();
    });

    it('returns 400 for invalid captureType', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sessions/session-1/captures',
        payload: { captureType: 'invalid', triggerType: 'manual' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 400 for invalid triggerType', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sessions/session-1/captures',
        payload: { captureType: 'photo', triggerType: 'invalid_trigger' },
      });

      expect(response.statusCode).toBe(400);
    });

    it('returns 400 for missing body', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/sessions/session-1/captures',
      });

      expect(response.statusCode).toBe(400);
    });

    it('calls mediaRepository.create with correct params', async () => {
      const capture = createTestMediaCapture();
      mockCreate.mockResolvedValue(capture);

      await app.inject({
        method: 'POST',
        url: '/api/sessions/test-session/captures',
        payload: { captureType: 'video', triggerType: 'post_ceremony', durationMs: 5000 },
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          sessionId: 'test-session',
          triggerType: 'post_ceremony',
        }),
      );
    });

    it('passes userId from body when provided', async () => {
      const capture = createTestMediaCapture({ user_id: 'user-abc' });
      mockCreate.mockResolvedValue(capture);

      await app.inject({
        method: 'POST',
        url: '/api/sessions/session-1/captures',
        payload: { captureType: 'photo', triggerType: 'manual', userId: 'user-abc' },
      });

      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'user-abc',
        }),
      );
    });

    it('returns 500 with structured error when DB create fails', async () => {
      mockCreate.mockRejectedValue(new Error('DB connection failed'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/sessions/session-1/captures',
        payload: { captureType: 'photo', triggerType: 'manual' },
      });

      expect(response.statusCode).toBe(500);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      expect(body).toHaveProperty('error');
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('INTERNAL_ERROR');
    });

    it('generates correct storage path extension for each capture type', async () => {
      const capture = createTestMediaCapture();
      mockCreate.mockResolvedValue(capture);

      // Photo -> jpg
      await app.inject({
        method: 'POST',
        url: '/api/sessions/s1/captures',
        payload: { captureType: 'photo', triggerType: 'manual' },
      });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          storagePath: expect.stringContaining('.jpg'),
        }),
      );

      mockCreate.mockClear();
      mockCreate.mockResolvedValue(capture);

      // Video -> mp4
      await app.inject({
        method: 'POST',
        url: '/api/sessions/s1/captures',
        payload: { captureType: 'video', triggerType: 'manual' },
      });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          storagePath: expect.stringContaining('.mp4'),
        }),
      );

      mockCreate.mockClear();
      mockCreate.mockResolvedValue(capture);

      // Audio -> m4a
      await app.inject({
        method: 'POST',
        url: '/api/sessions/s1/captures',
        payload: { captureType: 'audio', triggerType: 'manual' },
      });
      expect(mockCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          storagePath: expect.stringContaining('.m4a'),
        }),
      );
    });
  });

  describe('GET /api/sessions/:sessionId/captures', () => {
    it('returns capture list for authenticated participant', async () => {
      setupFirebaseAuth('user-1');
      mockIsSessionParticipant.mockResolvedValue(true);
      const captures = [
        createTestMediaCapture({ session_id: 'session-1' }),
        createTestMediaCapture({ session_id: 'session-1' }),
      ];
      mockFindBySessionId.mockResolvedValue(captures);

      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions/session-1/captures',
        headers: makeAuthenticatedHeader(),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['captures']).toHaveLength(2);
    });

    it('returns 401 without auth header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions/session-1/captures',
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 403 for non-participants', async () => {
      setupFirebaseAuth('user-1');
      mockIsSessionParticipant.mockResolvedValue(false);

      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions/session-1/captures',
        headers: makeAuthenticatedHeader(),
      });

      expect(response.statusCode).toBe(403);
    });
  });

  describe('GET /api/sessions/:sessionId/captures/:captureId/upload-url', () => {
    it('returns signed URL for capture owner', async () => {
      setupFirebaseAuth('user-1');
      const capture = createTestMediaCapture({ session_id: 'session-1', user_id: 'user-1' });
      mockFindById.mockResolvedValue(capture);
      mockGenerateUploadUrl.mockResolvedValue('https://storage.googleapis.com/upload');

      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/session-1/captures/${capture.id}/upload-url`,
        headers: makeAuthenticatedHeader(),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['uploadUrl']).toBe('https://storage.googleapis.com/upload');
      expect(data['storagePath']).toBe(capture.storage_path);
    });

    it('returns 401 without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions/session-1/captures/capture-1/upload-url',
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 403 for non-owner', async () => {
      setupFirebaseAuth('user-2');
      const capture = createTestMediaCapture({ session_id: 'session-1', user_id: 'user-1' });
      mockFindById.mockResolvedValue(capture);

      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/session-1/captures/${capture.id}/upload-url`,
        headers: makeAuthenticatedHeader(),
      });

      expect(response.statusCode).toBe(403);
    });

    it('returns 404 for non-existent capture', async () => {
      setupFirebaseAuth('user-1');
      mockFindById.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions/session-1/captures/nonexistent/upload-url',
        headers: makeAuthenticatedHeader(),
      });

      expect(response.statusCode).toBe(404);
    });
  });

  describe('GET /api/sessions/:sessionId/captures/:captureId/download-url', () => {
    it('returns signed URL for authenticated participant', async () => {
      setupFirebaseAuth('user-1');
      const capture = createTestMediaCapture({ session_id: 'session-1', user_id: 'user-1' });
      mockFindById.mockResolvedValue(capture);
      mockIsSessionParticipant.mockResolvedValue(true);
      mockFileExists.mockResolvedValue(true);
      const expiresAt = new Date('2026-03-25T00:00:00Z');
      mockGenerateDownloadUrl.mockResolvedValue({ url: 'https://storage.googleapis.com/download', expiresAt });

      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/session-1/captures/${capture.id}/download-url`,
        headers: makeAuthenticatedHeader(),
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['downloadUrl']).toBe('https://storage.googleapis.com/download');
      expect(data['expiresAt']).toBe('2026-03-25T00:00:00.000Z');
    });

    it('returns 401 without auth', async () => {
      const response = await app.inject({
        method: 'GET',
        url: '/api/sessions/session-1/captures/capture-1/download-url',
      });

      expect(response.statusCode).toBe(401);
    });

    it('returns 403 for non-participants', async () => {
      setupFirebaseAuth('user-1');
      const capture = createTestMediaCapture({ session_id: 'session-1' });
      mockFindById.mockResolvedValue(capture);
      mockIsSessionParticipant.mockResolvedValue(false);

      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/session-1/captures/${capture.id}/download-url`,
        headers: makeAuthenticatedHeader(),
      });

      expect(response.statusCode).toBe(403);
    });

    it('returns 403 for guest when session ended > 7 days ago', async () => {
      setupGuestAuth('guest-1', 'session-1');
      const capture = createTestMediaCapture({ session_id: 'session-1', user_id: 'guest-1' });
      mockFindById.mockResolvedValue(capture);
      mockIsSessionParticipant.mockResolvedValue(true);

      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      const session = createTestSession({ id: 'session-1', ended_at: eightDaysAgo });
      mockSessionFindById.mockResolvedValue(session);

      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/session-1/captures/${capture.id}/download-url`,
        headers: makeGuestHeader(),
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['message']).toBe('Guest media access expired');
    });

    it('allows guest when session ended < 7 days ago', async () => {
      setupGuestAuth('guest-1', 'session-1');
      const capture = createTestMediaCapture({ session_id: 'session-1', user_id: 'guest-1' });
      mockFindById.mockResolvedValue(capture);
      mockIsSessionParticipant.mockResolvedValue(true);
      mockFileExists.mockResolvedValue(true);

      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      const session = createTestSession({ id: 'session-1', ended_at: twoDaysAgo });
      mockSessionFindById.mockResolvedValue(session);

      const expiresAt = new Date('2026-03-25T00:00:00Z');
      mockGenerateDownloadUrl.mockResolvedValue({ url: 'https://storage.googleapis.com/download', expiresAt });

      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/session-1/captures/${capture.id}/download-url`,
        headers: makeGuestHeader(),
      });

      expect(response.statusCode).toBe(200);
    });

    it('returns 404 when file not in storage', async () => {
      setupFirebaseAuth('user-1');
      const capture = createTestMediaCapture({ session_id: 'session-1' });
      mockFindById.mockResolvedValue(capture);
      mockIsSessionParticipant.mockResolvedValue(true);
      mockFileExists.mockResolvedValue(false);

      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/session-1/captures/${capture.id}/download-url`,
        headers: makeAuthenticatedHeader(),
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('FILE_NOT_FOUND');
    });

    it('returns 404 for capture from different session', async () => {
      setupFirebaseAuth('user-1');
      const capture = createTestMediaCapture({ session_id: 'other-session' });
      mockFindById.mockResolvedValue(capture);

      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/session-1/captures/${capture.id}/download-url`,
        headers: makeAuthenticatedHeader(),
      });

      expect(response.statusCode).toBe(404);
    });
  });
});
