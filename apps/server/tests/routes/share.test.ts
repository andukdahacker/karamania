import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import { errorHandler } from '../../src/shared/errors.js';
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

const mockFindById = vi.fn();
vi.mock('../../src/persistence/session-repository.js', () => ({
  findById: mockFindById,
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

function createEndedSessionWithSummary(overrides?: Record<string, unknown>) {
  return createTestSession({
    status: 'ended',
    ended_at: new Date('2026-03-10T20:00:00Z'),
    summary: JSON.stringify(testSummary),
    venue_name: 'Studio A',
    vibe: 'rock',
    ...overrides,
  });
}

describe('GET /api/sessions/:id/share', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.setErrorHandler(errorHandler);
    const { shareRoutes } = await import('../../src/routes/share.js');
    await app.register(shareRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns public session data for ended session with no auth required', async () => {
    const session = createEndedSessionWithSummary();
    mockFindById.mockResolvedValue(session);
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
      url: `/api/sessions/${session.id}/share`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    const data = body['data'] as Record<string, unknown>;
    expect(data['id']).toBe(session.id);
    expect(data['venueName']).toBe('Studio A');
    expect(data['vibe']).toBe('rock');

    const stats = data['stats'] as Record<string, unknown>;
    expect(stats['songCount']).toBe(3);
    expect(stats['participantCount']).toBe(4);
    expect(stats['totalReactions']).toBe(50);

    const participants = data['participants'] as Array<Record<string, unknown>>;
    expect(participants).toHaveLength(2);
    expect(participants[0]!['displayName']).toBe('Alice');
    // Verify NO userId fields in participants (stripped for privacy)
    expect(participants[0]).not.toHaveProperty('userId');
    expect(participants[1]).not.toHaveProperty('userId');

    const setlist = data['setlist'] as Array<Record<string, unknown>>;
    expect(setlist).toHaveLength(1);
    expect(setlist[0]!['title']).toBe('Bohemian Rhapsody');

    const mediaUrls = data['mediaUrls'] as string[];
    expect(mediaUrls).toHaveLength(1);
    expect(mediaUrls[0]).toBe('https://signed-url.com/photo.jpg');
  });

  it('returns 404 for non-existent session', async () => {
    mockFindById.mockResolvedValue(undefined);

    const response = await app.inject({
      method: 'GET',
      url: '/api/sessions/nonexistent-id/share',
    });

    expect(response.statusCode).toBe(404);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    const error = body['error'] as Record<string, unknown>;
    expect(error['code']).toBe('SESSION_NOT_FOUND');
  });

  it('returns 404 for active (non-ended) session', async () => {
    const session = createTestSession({ status: 'active' });
    mockFindById.mockResolvedValue(session);

    const response = await app.inject({
      method: 'GET',
      url: `/api/sessions/${session.id}/share`,
    });

    expect(response.statusCode).toBe(404);
  });

  it('returns 404 for session without summary', async () => {
    const session = createTestSession({
      status: 'ended',
      ended_at: new Date('2026-03-10T20:00:00Z'),
      summary: null,
    });
    mockFindById.mockResolvedValue(session);

    const response = await app.inject({
      method: 'GET',
      url: `/api/sessions/${session.id}/share`,
    });

    expect(response.statusCode).toBe(404);
  });

  it('handles media with unavailable storage gracefully', async () => {
    const session = createEndedSessionWithSummary();
    mockFindById.mockResolvedValue(session);
    mockFindMediaBySessionId.mockResolvedValue([
      {
        id: 'capture-1',
        storage_path: 'session-1/photo.jpg',
        trigger_type: 'manual',
        created_at: new Date('2026-03-10T19:00:00Z'),
      },
    ]);

    const { StorageUnavailableError } = await import('../../src/services/media-storage.js');
    mockGenerateDownloadUrl.mockRejectedValue(new StorageUnavailableError());

    const response = await app.inject({
      method: 'GET',
      url: `/api/sessions/${session.id}/share`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    const data = body['data'] as Record<string, unknown>;
    const mediaUrls = data['mediaUrls'] as string[];
    expect(mediaUrls).toHaveLength(0);
  });

  it('returns media URLs as string array (not objects)', async () => {
    const session = createEndedSessionWithSummary();
    mockFindById.mockResolvedValue(session);
    mockFindMediaBySessionId.mockResolvedValue([
      { id: 'c1', storage_path: 'path1.jpg', trigger_type: 'manual', created_at: new Date() },
      { id: 'c2', storage_path: 'path2.jpg', trigger_type: 'peak', created_at: new Date() },
    ]);
    mockGenerateDownloadUrl
      .mockResolvedValueOnce({ url: 'https://url1.com', expiresAt: new Date() })
      .mockResolvedValueOnce({ url: 'https://url2.com', expiresAt: new Date() });

    const response = await app.inject({
      method: 'GET',
      url: `/api/sessions/${session.id}/share`,
    });

    expect(response.statusCode).toBe(200);
    const body = JSON.parse(response.body) as Record<string, unknown>;
    const data = body['data'] as Record<string, unknown>;
    const mediaUrls = data['mediaUrls'] as string[];
    expect(mediaUrls).toHaveLength(2);
    expect(typeof mediaUrls[0]).toBe('string');
    expect(typeof mediaUrls[1]).toBe('string');
  });
});
