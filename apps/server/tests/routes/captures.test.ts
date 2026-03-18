import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import { createTestMediaCapture } from '../factories/media-capture.js';
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
    NODE_ENV: 'test',
    PORT: 3000,
  },
}));

const mockCreate = vi.fn();
vi.mock('../../src/persistence/media-repository.js', () => ({
  create: (...args: unknown[]) => mockCreate(...args),
}));

vi.mock('../../src/db/connection.js', () => ({
  db: {},
}));

describe('POST /api/sessions/:sessionId/captures', () => {
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
