import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import { errorHandler } from '../../src/shared/errors.js';

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

vi.mock('../../src/services/guest-token.js', () => ({
  verifyGuestToken: vi.fn(),
}));

vi.mock('../../src/persistence/session-repository.js', () => ({
  findById: vi.fn(),
  getParticipants: vi.fn(),
}));

vi.mock('../../src/persistence/catalog-repository.js', () => ({
  findClassics: vi.fn(),
}));

vi.mock('../../src/services/song-pool.js', () => ({
  getPooledSongs: vi.fn(),
  getSungSongKeys: vi.fn(),
}));

import { verifyFirebaseToken } from '../../src/integrations/firebase-admin.js';
import { verifyGuestToken } from '../../src/services/guest-token.js';
import * as sessionRepo from '../../src/persistence/session-repository.js';
import * as catalogRepository from '../../src/persistence/catalog-repository.js';
import * as songPool from '../../src/services/song-pool.js';

const mockVerifyFirebase = vi.mocked(verifyFirebaseToken);
const mockVerifyGuest = vi.mocked(verifyGuestToken);
const mockFindById = vi.mocked(sessionRepo.findById);
const mockGetParticipants = vi.mocked(sessionRepo.getParticipants);
const mockFindClassics = vi.mocked(catalogRepository.findClassics);
const mockGetPooledSongs = vi.mocked(songPool.getPooledSongs);
const mockGetSungSongKeys = vi.mocked(songPool.getSungSongKeys);

const VALID_SESSION_ID = 'a0000000-0000-4000-a000-000000000001';

describe('suggestion routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.setErrorHandler(errorHandler);
    const { suggestionRoutes } = await import('../../src/routes/suggestions.js');
    await app.register(suggestionRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('GET /api/sessions/:sessionId/suggestions', () => {
    it('returns suggestions with valid auth and active session', async () => {
      mockVerifyFirebase.mockResolvedValue({ uid: 'user-1' } as any);
      mockFindById.mockResolvedValue({ id: VALID_SESSION_ID, status: 'active' } as any);
      mockGetParticipants.mockResolvedValue([{ id: 'p1', user_id: 'user-1', guest_name: null, display_name: 'User 1', joined_at: new Date() }] as any);
      mockGetPooledSongs.mockReturnValue([
        {
          catalogTrackId: 'cat-1',
          songTitle: 'Hello',
          artist: 'Adele',
          youtubeVideoId: 'yt1',
          channel: null,
          isClassic: false,
          overlapCount: 2,
          importedBy: new Set(['a', 'b']),
        },
      ]);
      mockGetSungSongKeys.mockReturnValue(new Set());

      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/${VALID_SESSION_ID}/suggestions`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      const suggestions = data['suggestions'] as Array<Record<string, unknown>>;
      expect(suggestions).toHaveLength(1);
      expect(suggestions[0]!['songTitle']).toBe('Hello');
      expect(suggestions[0]!['overlapCount']).toBe(2);
    });

    it('returns 401 with no auth header', async () => {
      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/${VALID_SESSION_ID}/suggestions`,
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('AUTH_REQUIRED');
    });

    it('returns 401 with invalid token', async () => {
      mockVerifyFirebase.mockRejectedValue(new Error('Invalid'));
      mockVerifyGuest.mockRejectedValue(new Error('Invalid'));

      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/${VALID_SESSION_ID}/suggestions`,
        headers: { authorization: 'Bearer bad-token' },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('AUTH_INVALID');
    });

    it('returns 404 with nonexistent session', async () => {
      mockVerifyFirebase.mockResolvedValue({ uid: 'user-1' } as any);
      mockFindById.mockResolvedValue(undefined);

      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/${VALID_SESSION_ID}/suggestions`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('SESSION_NOT_FOUND');
    });

    it('returns 404 with ended session', async () => {
      mockVerifyFirebase.mockResolvedValue({ uid: 'user-1' } as any);
      mockFindById.mockResolvedValue({ id: VALID_SESSION_ID, status: 'ended' } as any);

      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/${VALID_SESSION_ID}/suggestions`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('SESSION_NOT_FOUND');
    });

    it('returns 403 when authenticated user is not a session participant', async () => {
      mockVerifyFirebase.mockResolvedValue({ uid: 'outsider-user' } as any);
      mockFindById.mockResolvedValue({ id: VALID_SESSION_ID, status: 'active' } as any);
      mockGetParticipants.mockResolvedValue([{ id: 'p1', user_id: 'user-1', guest_name: null, display_name: 'User 1', joined_at: new Date() }] as any);

      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/${VALID_SESSION_ID}/suggestions`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('NOT_PARTICIPANT');
    });

    it('count query parameter controls suggestion count', async () => {
      mockVerifyFirebase.mockResolvedValue({ uid: 'user-1' } as any);
      mockFindById.mockResolvedValue({ id: VALID_SESSION_ID, status: 'active' } as any);
      mockGetParticipants.mockResolvedValue([{ id: 'p1', user_id: 'user-1', guest_name: null, display_name: 'User 1', joined_at: new Date() }] as any);

      const songs = Array.from({ length: 10 }, (_, i) => ({
        catalogTrackId: `cat-${i}`,
        songTitle: `Song ${i}`,
        artist: `Artist ${i}`,
        youtubeVideoId: `yt${i}`,
        channel: null,
        isClassic: false,
        overlapCount: 1,
        importedBy: new Set(['a']),
      }));
      mockGetPooledSongs.mockReturnValue(songs);
      mockGetSungSongKeys.mockReturnValue(new Set());

      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/${VALID_SESSION_ID}/suggestions?count=3`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      const suggestions = data['suggestions'] as Array<Record<string, unknown>>;
      expect(suggestions).toHaveLength(3);
    });

    it('cold start session: returns classic songs', async () => {
      mockVerifyFirebase.mockResolvedValue({ uid: 'user-1' } as any);
      mockFindById.mockResolvedValue({ id: VALID_SESSION_ID, status: 'active' } as any);
      mockGetParticipants.mockResolvedValue([{ id: 'p1', user_id: 'user-1', guest_name: null, display_name: 'User 1', joined_at: new Date() }] as any);
      mockGetPooledSongs.mockReturnValue([]);
      mockFindClassics.mockResolvedValue([
        { id: 'classic-1', song_title: 'Bohemian Rhapsody', artist: 'Queen', youtube_video_id: 'yt1', channel: null, is_classic: true, created_at: new Date(), updated_at: new Date() },
        { id: 'classic-2', song_title: "Don't Stop Believin'", artist: 'Journey', youtube_video_id: 'yt2', channel: null, is_classic: true, created_at: new Date(), updated_at: new Date() },
      ]);

      const response = await app.inject({
        method: 'GET',
        url: `/api/sessions/${VALID_SESSION_ID}/suggestions`,
        headers: { authorization: 'Bearer valid-token' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      const suggestions = data['suggestions'] as Array<Record<string, unknown>>;
      expect(suggestions).toHaveLength(2);
      expect(mockFindClassics).toHaveBeenCalled();
    });
  });
});
