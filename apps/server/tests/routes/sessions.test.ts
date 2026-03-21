import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import { errorHandler } from '../../src/shared/errors.js';
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
const mockFindByFirebaseUid = vi.fn();
vi.mock('../../src/persistence/user-repository.js', () => ({
  upsertFromFirebase: mockUpsertFromFirebase,
  createGuestUser: mockCreateGuestUser,
  findByFirebaseUid: mockFindByFirebaseUid,
}));

const mockCreateSession = vi.fn();
vi.mock('../../src/services/session-manager.js', () => ({
  createSession: mockCreateSession,
}));

const mockGenerateGuestToken = vi.fn();
vi.mock('../../src/services/guest-token.js', () => ({
  generateGuestToken: mockGenerateGuestToken,
}));

const mockFindUserSessions = vi.fn();
const mockCountUserSessions = vi.fn();
const mockFindSessionDetail = vi.fn();
vi.mock('../../src/persistence/session-repository.js', () => ({
  findUserSessions: mockFindUserSessions,
  countUserSessions: mockCountUserSessions,
  findSessionDetail: mockFindSessionDetail,
}));

const mockFindMediaBySessionId = vi.fn();
vi.mock('../../src/persistence/media-repository.js', () => ({
  findBySessionId: mockFindMediaBySessionId,
}));

const mockGenerateDownloadUrl = vi.fn();
vi.mock('../../src/services/media-storage.js', () => ({
  generateDownloadUrl: mockGenerateDownloadUrl,
  StorageUnavailableError: class StorageUnavailableError extends Error {
    readonly code = 'STORAGE_UNAVAILABLE';
    constructor() { super('Firebase Storage not configured'); this.name = 'StorageUnavailableError'; }
  },
}));

describe('POST /api/sessions', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.setErrorHandler(errorHandler);
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

describe('GET /api/sessions', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.setErrorHandler(errorHandler);
    const { sessionRoutes } = await import('../../src/routes/sessions.js');
    await app.register(sessionRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  function setupAuthUser(userId = 'user-1') {
    const testUser = createTestUser({ id: userId, display_name: 'Test User' });
    mockVerifyFirebaseToken.mockResolvedValue({ uid: 'fb-uid-1', name: 'Test User' });
    mockFindByFirebaseUid.mockResolvedValue(testUser);
    return testUser;
  }

  it('returns 401 without auth', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions',
    });

    expect(response.statusCode).toBe(401);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    expect(body).toHaveProperty('error');
  });

  it('returns paginated session list', async () => {
    const user = setupAuthUser();
    mockFindUserSessions.mockResolvedValue([
      {
        id: 'session-1',
        venue_name: 'Studio A',
        ended_at: new Date('2026-03-10T20:00:00Z'),
        participant_count: 5,
        top_award: 'Star of the Show',
        thumbnail_storage_path: 'session-1/capture.jpg',
      },
    ]);
    mockCountUserSessions.mockResolvedValue(1);
    mockGenerateDownloadUrl.mockResolvedValue({ url: 'https://signed-url.com/thumb.jpg', expiresAt: new Date() });

    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    const data = body['data'] as Record<string, unknown>;
    const sessions = data['sessions'] as Array<Record<string, unknown>>;
    expect(sessions).toHaveLength(1);
    expect(sessions[0]!['id']).toBe('session-1');
    expect(sessions[0]!['venueName']).toBe('Studio A');
    expect(sessions[0]!['participantCount']).toBe(5);
    expect(sessions[0]!['topAward']).toBe('Star of the Show');
    expect(sessions[0]!['thumbnailUrl']).toBe('https://signed-url.com/thumb.jpg');
    expect(data['total']).toBe(1);
    expect(data['offset']).toBe(0);
    expect(data['limit']).toBe(20);
    expect(mockFindUserSessions).toHaveBeenCalledWith(user.id, 20, 0);
  });

  it('returns empty array for new user', async () => {
    setupAuthUser();
    mockFindUserSessions.mockResolvedValue([]);
    mockCountUserSessions.mockResolvedValue(0);

    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    const data = body['data'] as Record<string, unknown>;
    const sessions = data['sessions'] as Array<unknown>;
    expect(sessions).toHaveLength(0);
    expect(data['total']).toBe(0);
  });

  it('respects limit/offset query params', async () => {
    setupAuthUser();
    mockFindUserSessions.mockResolvedValue([]);
    mockCountUserSessions.mockResolvedValue(25);

    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions?limit=10&offset=5',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    const data = body['data'] as Record<string, unknown>;
    expect(data['limit']).toBe(10);
    expect(data['offset']).toBe(5);
    expect(mockFindUserSessions).toHaveBeenCalledWith(expect.any(String), 10, 5);
  });

  it('validates query params (limit too high)', async () => {
    setupAuthUser();

    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions?limit=100',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('validates query params (negative offset)', async () => {
    setupAuthUser();

    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions?offset=-1',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(400);
  });

  it('handles null thumbnail gracefully', async () => {
    setupAuthUser();
    mockFindUserSessions.mockResolvedValue([
      {
        id: 'session-2',
        venue_name: null,
        ended_at: new Date('2026-03-10T20:00:00Z'),
        participant_count: 3,
        top_award: null,
        thumbnail_storage_path: null,
      },
    ]);
    mockCountUserSessions.mockResolvedValue(1);

    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    const data = body['data'] as Record<string, unknown>;
    const sessions = data['sessions'] as Array<Record<string, unknown>>;
    expect(sessions[0]!['thumbnailUrl']).toBeNull();
    expect(sessions[0]!['venueName']).toBeNull();
    expect(mockGenerateDownloadUrl).not.toHaveBeenCalled();
  });
});

describe('GET /api/sessions/:id', () => {
  let app: ReturnType<typeof Fastify>;

  const testSummary = {
    version: 1,
    generatedAt: 1710936000000,
    stats: {
      songCount: 3,
      participantCount: 4,
      sessionDurationMs: 3600000,
      totalReactions: 50,
      totalSoundboardPlays: 10,
      totalCardsDealt: 5,
      topReactor: { displayName: 'Alice', count: 20 },
      longestStreak: 8,
    },
    setlist: [
      { position: 1, title: 'Bohemian Rhapsody', artist: 'Queen', performerName: 'Alice', awardTitle: 'Star', awardTone: 'hype' },
    ],
    awards: [
      { userId: 'user-1', displayName: 'Alice', category: 'performer', title: 'Star', tone: 'hype', reason: 'Nailed it' },
    ],
    participants: [
      { userId: 'user-1', displayName: 'Alice', participationScore: 100, topAward: 'Star' },
      { userId: null, displayName: 'Guest Bob', participationScore: 50, topAward: null },
    ],
  };

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.setErrorHandler(errorHandler);
    const { sessionRoutes } = await import('../../src/routes/sessions.js');
    await app.register(sessionRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  function setupAuthUser(userId = 'user-1') {
    const testUser = createTestUser({ id: userId, display_name: 'Test User' });
    mockVerifyFirebaseToken.mockResolvedValue({ uid: 'fb-uid-1', name: 'Test User' });
    mockFindByFirebaseUid.mockResolvedValue(testUser);
    return testUser;
  }

  it('returns 401 without auth', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions/some-id',
    });

    expect(response.statusCode).toBe(401);
  });

  it('returns 403 when user is not host or participant', async () => {
    setupAuthUser();
    mockFindSessionDetail.mockResolvedValue(null);

    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions/session-id',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(403);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    const error = body['error'] as Record<string, unknown>;
    expect(error['code']).toBe('SESSION_ACCESS_DENIED');
  });

  it('returns full session detail with all sections', async () => {
    const user = setupAuthUser();
    mockFindSessionDetail.mockResolvedValue({
      id: 'session-1',
      venue_name: 'Studio A',
      vibe: 'rock',
      created_at: new Date('2026-03-10T18:00:00Z'),
      ended_at: new Date('2026-03-10T20:00:00Z'),
      summary: JSON.stringify(testSummary),
    });
    mockFindMediaBySessionId.mockResolvedValue([
      {
        id: 'capture-1',
        storage_path: 'session-1/photo.jpg',
        trigger_type: 'manual',
        created_at: new Date('2026-03-10T19:00:00Z'),
      },
    ]);
    mockGenerateDownloadUrl.mockResolvedValue({ url: 'https://signed-url.com/photo.jpg', expiresAt: new Date() });

    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions/session-1',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    const data = body['data'] as Record<string, unknown>;
    expect(data['id']).toBe('session-1');
    expect(data['venueName']).toBe('Studio A');
    expect(data['vibe']).toBe('rock');

    const stats = data['stats'] as Record<string, unknown>;
    expect(stats['songCount']).toBe(3);
    expect(stats['participantCount']).toBe(4);
    expect(stats['totalReactions']).toBe(50);

    const participants = data['participants'] as Array<Record<string, unknown>>;
    expect(participants).toHaveLength(2);
    expect(participants[0]!['displayName']).toBe('Alice');

    const setlist = data['setlist'] as Array<Record<string, unknown>>;
    expect(setlist).toHaveLength(1);
    expect(setlist[0]!['title']).toBe('Bohemian Rhapsody');

    const awards = data['awards'] as Array<Record<string, unknown>>;
    expect(awards).toHaveLength(1);

    const media = data['media'] as Array<Record<string, unknown>>;
    expect(media).toHaveLength(1);
    expect(media[0]!['url']).toBe('https://signed-url.com/photo.jpg');
    expect(media[0]!['triggerType']).toBe('manual');

    expect(mockFindSessionDetail).toHaveBeenCalledWith('session-1', user.id);
  });

  it('returns 403 for non-existent session (NOT 404)', async () => {
    setupAuthUser();
    mockFindSessionDetail.mockResolvedValue(null);

    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions/nonexistent-id',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(403);
  });

  it('handles media with unavailable storage gracefully (url = null)', async () => {
    setupAuthUser();
    mockFindSessionDetail.mockResolvedValue({
      id: 'session-2',
      venue_name: null,
      vibe: null,
      created_at: new Date('2026-03-10T18:00:00Z'),
      ended_at: new Date('2026-03-10T20:00:00Z'),
      summary: JSON.stringify(testSummary),
    });
    mockFindMediaBySessionId.mockResolvedValue([
      {
        id: 'capture-1',
        storage_path: 'session-2/photo.jpg',
        trigger_type: 'manual',
        created_at: new Date('2026-03-10T19:00:00Z'),
      },
    ]);

    // Import StorageUnavailableError to throw the correct type
    const { StorageUnavailableError } = await import('../../src/services/media-storage.js');
    mockGenerateDownloadUrl.mockRejectedValue(new StorageUnavailableError());

    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions/session-2',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    const data = body['data'] as Record<string, unknown>;
    const media = data['media'] as Array<Record<string, unknown>>;
    expect(media[0]!['url']).toBeNull();
  });
});
