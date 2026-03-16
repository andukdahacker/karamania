import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import { errorHandler } from '../../src/shared/errors.js';
import { createTestCatalogTrack } from '../factories/catalog.js';

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

const mockExtractPlaylistId = vi.fn();
const mockFetchPlaylistTracks = vi.fn();

vi.mock('../../src/integrations/youtube-data.js', () => ({
  extractPlaylistId: mockExtractPlaylistId,
  fetchPlaylistTracks: mockFetchPlaylistTracks,
}));

const mockExtractSpotifyId = vi.fn();
const mockFetchSpotifyTracks = vi.fn();

vi.mock('../../src/integrations/spotify-data.js', () => ({
  extractPlaylistId: mockExtractSpotifyId,
  fetchPlaylistTracks: mockFetchSpotifyTracks,
}));

const mockIntersectWithSongs = vi.fn();

vi.mock('../../src/persistence/catalog-repository.js', () => ({
  intersectWithSongs: mockIntersectWithSongs,
}));

vi.mock('../../src/integrations/firebase-admin.js', () => ({
  verifyFirebaseToken: vi.fn(),
}));

vi.mock('../../src/services/guest-token.js', () => ({
  verifyGuestToken: vi.fn(),
}));

vi.mock('../../src/persistence/session-repository.js', () => ({
  findById: vi.fn(),
}));

vi.mock('../../src/services/song-pool.js', () => ({
  addImportedSongs: vi.fn(),
  getPooledSongs: vi.fn(),
}));

import { verifyFirebaseToken } from '../../src/integrations/firebase-admin.js';
import { verifyGuestToken } from '../../src/services/guest-token.js';
import * as sessionRepo from '../../src/persistence/session-repository.js';
import * as songPool from '../../src/services/song-pool.js';

const mockVerifyFirebase = vi.mocked(verifyFirebaseToken);
const mockVerifyGuest = vi.mocked(verifyGuestToken);
const mockFindById = vi.mocked(sessionRepo.findById);
const mockAddImportedSongs = vi.mocked(songPool.addImportedSongs);
const mockGetPooledSongs = vi.mocked(songPool.getPooledSongs);

const VALID_SESSION_ID = 'a0000000-0000-4000-a000-000000000001';

describe('playlist routes', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.setErrorHandler(errorHandler);
    const { playlistRoutes } = await import('../../src/routes/playlists.js');
    await app.register(playlistRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  describe('POST /api/playlists/import', () => {
    it('returns 400 for invalid playlist URL', async () => {
      mockExtractPlaylistId.mockReturnValue(null);
      mockExtractSpotifyId.mockReturnValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/playlists/import',
        payload: { playlistUrl: 'https://music.youtube.com/playlist?list=PLtest' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('INVALID_PLAYLIST_URL');
    });

    it('returns 400 for non-URL input', async () => {
      const response = await app.inject({
        method: 'POST',
        url: '/api/playlists/import',
        payload: { playlistUrl: 'not-a-url' },
      });

      // Zod validation catches non-URL before handler
      expect(response.statusCode).toBe(400);
    });

    it('returns successful import with matched tracks', async () => {
      mockExtractPlaylistId.mockReturnValue('PLtest123');
      mockExtractSpotifyId.mockReturnValue(null);
      mockFetchPlaylistTracks.mockResolvedValue({
        tracks: [
          { songTitle: 'Bohemian Rhapsody', artist: 'Queen', youtubeVideoId: 'vid1' },
          { songTitle: 'Hello', artist: 'Adele', youtubeVideoId: 'vid2' },
        ],
        unparseable: 0,
        totalFetched: 2,
      });

      const catalogTrack = createTestCatalogTrack({
        song_title: 'Bohemian Rhapsody',
        artist: 'Queen',
        youtube_video_id: 'yt_catalog_1',
      });
      mockIntersectWithSongs.mockResolvedValue([catalogTrack]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/playlists/import',
        payload: { playlistUrl: 'https://music.youtube.com/playlist?list=PLtest123' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      const tracks = data['tracks'] as Array<Record<string, unknown>>;
      const matched = data['matched'] as Array<Record<string, unknown>>;

      expect(tracks).toHaveLength(2);
      expect(tracks[0]!['songTitle']).toBe('Bohemian Rhapsody');
      expect(matched).toHaveLength(1);
      expect(matched[0]!['songTitle']).toBe('Bohemian Rhapsody');
      expect(data['unmatchedCount']).toBe(1);
      expect(data['totalFetched']).toBe(2);
    });

    it('returns 502 when YouTube API fails', async () => {
      mockExtractPlaylistId.mockReturnValue('PLtest123');
      mockExtractSpotifyId.mockReturnValue(null);
      mockFetchPlaylistTracks.mockRejectedValue(new Error('YouTube API error: 403 Forbidden'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/playlists/import',
        payload: { playlistUrl: 'https://music.youtube.com/playlist?list=PLtest123' },
      });

      expect(response.statusCode).toBe(502);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('YOUTUBE_API_FAILED');
      expect(error['message']).toBe('YouTube API error: 403 Forbidden');
    });

    it('returns 404 with PLAYLIST_NOT_FOUND when playlist does not exist', async () => {
      mockExtractPlaylistId.mockReturnValue('PLbadid');
      mockExtractSpotifyId.mockReturnValue(null);
      mockFetchPlaylistTracks.mockRejectedValue(new Error('Playlist not found or is private'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/playlists/import',
        payload: { playlistUrl: 'https://music.youtube.com/playlist?list=PLbadid' },
      });

      expect(response.statusCode).toBe(404);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('PLAYLIST_NOT_FOUND');
    });

    it('handles empty playlist', async () => {
      mockExtractPlaylistId.mockReturnValue('PLempty');
      mockExtractSpotifyId.mockReturnValue(null);
      mockFetchPlaylistTracks.mockResolvedValue({
        tracks: [],
        unparseable: 0,
        totalFetched: 0,
      });

      const response = await app.inject({
        method: 'POST',
        url: '/api/playlists/import',
        payload: { playlistUrl: 'https://music.youtube.com/playlist?list=PLempty' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['tracks']).toEqual([]);
      expect(data['matched']).toEqual([]);
      expect(data['unmatchedCount']).toBe(0);
      expect(data['totalFetched']).toBe(0);
    });

    it('response shape matches { data: { tracks, matched, unmatchedCount, totalFetched } }', async () => {
      mockExtractPlaylistId.mockReturnValue('PLtest');
      mockExtractSpotifyId.mockReturnValue(null);
      mockFetchPlaylistTracks.mockResolvedValue({
        tracks: [{ songTitle: 'Hello', artist: 'Adele', youtubeVideoId: 'vid1' }],
        unparseable: 0,
        totalFetched: 1,
      });
      mockIntersectWithSongs.mockResolvedValue([]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/playlists/import',
        payload: { playlistUrl: 'https://music.youtube.com/playlist?list=PLtest' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      expect(body).toHaveProperty('data');
      const data = body['data'] as Record<string, unknown>;
      expect(data).toHaveProperty('tracks');
      expect(data).toHaveProperty('matched');
      expect(data).toHaveProperty('unmatchedCount');
      expect(data).toHaveProperty('totalFetched');
    });

    it('error response shape matches { error: { code, message } }', async () => {
      mockExtractPlaylistId.mockReturnValue(null);
      mockExtractSpotifyId.mockReturnValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/playlists/import',
        payload: { playlistUrl: 'https://music.youtube.com/playlist?list=PLtest' },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      expect(body).toHaveProperty('error');
      const error = body['error'] as Record<string, unknown>;
      expect(error).toHaveProperty('code');
      expect(error).toHaveProperty('message');
    });

    it('calls intersectWithSongs with correct parallel arrays', async () => {
      mockExtractPlaylistId.mockReturnValue('PLtest');
      mockExtractSpotifyId.mockReturnValue(null);
      mockFetchPlaylistTracks.mockResolvedValue({
        tracks: [
          { songTitle: 'Bohemian Rhapsody', artist: 'Queen', youtubeVideoId: 'vid1' },
          { songTitle: 'Hello', artist: 'Adele', youtubeVideoId: 'vid2' },
        ],
        unparseable: 0,
        totalFetched: 2,
      });
      mockIntersectWithSongs.mockResolvedValue([]);

      await app.inject({
        method: 'POST',
        url: '/api/playlists/import',
        payload: { playlistUrl: 'https://music.youtube.com/playlist?list=PLtest' },
      });

      expect(mockIntersectWithSongs).toHaveBeenCalledWith(
        ['Bohemian Rhapsody', 'Hello'],
        ['Queen', 'Adele'],
      );
    });

    it('returns successful import for Spotify URL', async () => {
      mockExtractPlaylistId.mockReturnValue(null);
      mockExtractSpotifyId.mockReturnValue('spotify123');
      mockFetchSpotifyTracks.mockResolvedValue({
        tracks: [
          { songTitle: 'Blinding Lights', artist: 'The Weeknd', youtubeVideoId: '' },
        ],
        unparseable: 0,
        totalFetched: 1,
      });
      mockIntersectWithSongs.mockResolvedValue([]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/playlists/import',
        payload: { playlistUrl: 'https://open.spotify.com/playlist/spotify123' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      const tracks = data['tracks'] as Array<Record<string, unknown>>;
      expect(tracks).toHaveLength(1);
      expect(tracks[0]!['songTitle']).toBe('Blinding Lights');
      expect(mockFetchSpotifyTracks).toHaveBeenCalledWith('spotify123', 'test-id', 'test-secret');
    });

    it('returns 403 with PLAYLIST_PRIVATE for private Spotify playlist', async () => {
      mockExtractPlaylistId.mockReturnValue(null);
      mockExtractSpotifyId.mockReturnValue('private123');
      mockFetchSpotifyTracks.mockRejectedValue(new Error('This Spotify playlist is private. Make it public in your Spotify app and try again.'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/playlists/import',
        payload: { playlistUrl: 'https://open.spotify.com/playlist/private123' },
      });

      expect(response.statusCode).toBe(403);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('PLAYLIST_PRIVATE');
    });

    it('returns 502 with SPOTIFY_API_FAILED for Spotify API errors', async () => {
      mockExtractPlaylistId.mockReturnValue(null);
      mockExtractSpotifyId.mockReturnValue('spotify123');
      mockFetchSpotifyTracks.mockRejectedValue(new Error('Spotify API error: 500 Internal Server Error'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/playlists/import',
        payload: { playlistUrl: 'https://open.spotify.com/playlist/spotify123' },
      });

      expect(response.statusCode).toBe(502);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('SPOTIFY_API_FAILED');
    });

    it('prefers YouTube detection over Spotify', async () => {
      mockExtractPlaylistId.mockReturnValue('PLtest');
      mockExtractSpotifyId.mockReturnValue('spotify123');
      mockFetchPlaylistTracks.mockResolvedValue({
        tracks: [],
        unparseable: 0,
        totalFetched: 0,
      });

      await app.inject({
        method: 'POST',
        url: '/api/playlists/import',
        payload: { playlistUrl: 'https://music.youtube.com/playlist?list=PLtest' },
      });

      expect(mockFetchPlaylistTracks).toHaveBeenCalled();
      expect(mockFetchSpotifyTracks).not.toHaveBeenCalled();
    });

    // --- New tests for sessionId + auth + pool ---

    it('import with sessionId + valid Firebase auth: calls addImportedSongs and returns poolStats', async () => {
      mockExtractPlaylistId.mockReturnValue('PLtest');
      mockExtractSpotifyId.mockReturnValue(null);
      mockFetchPlaylistTracks.mockResolvedValue({
        tracks: [{ songTitle: 'Hello', artist: 'Adele', youtubeVideoId: 'vid1' }],
        unparseable: 0,
        totalFetched: 1,
      });
      const catalogTrack = createTestCatalogTrack({ song_title: 'Hello', artist: 'Adele' });
      mockIntersectWithSongs.mockResolvedValue([catalogTrack]);
      mockVerifyFirebase.mockResolvedValue({ uid: 'firebase-user-1' } as any);
      mockFindById.mockResolvedValue({ id: VALID_SESSION_ID, status: 'active' } as any);
      mockAddImportedSongs.mockReturnValue({ newSongs: 1, updatedOverlaps: 0 });
      mockGetPooledSongs.mockReturnValue([{ catalogTrackId: catalogTrack.id }] as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/playlists/import',
        headers: { authorization: 'Bearer valid-firebase-token' },
        payload: { playlistUrl: 'https://music.youtube.com/playlist?list=PLtest', sessionId: VALID_SESSION_ID },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      const poolStats = data['poolStats'] as Record<string, unknown>;
      expect(poolStats).toBeDefined();
      expect(poolStats['newSongs']).toBe(1);
      expect(poolStats['updatedOverlaps']).toBe(0);
      expect(poolStats['totalPoolSize']).toBe(1);
      expect(mockAddImportedSongs).toHaveBeenCalledWith(VALID_SESSION_ID, 'firebase-user-1', [catalogTrack]);
    });

    it('import with sessionId + NO auth header: returns 401 AUTH_REQUIRED', async () => {
      mockExtractPlaylistId.mockReturnValue('PLtest');
      mockExtractSpotifyId.mockReturnValue(null);

      const response = await app.inject({
        method: 'POST',
        url: '/api/playlists/import',
        payload: { playlistUrl: 'https://music.youtube.com/playlist?list=PLtest', sessionId: VALID_SESSION_ID },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('AUTH_REQUIRED');
    });

    it('import with sessionId + invalid token: returns 401 AUTH_INVALID', async () => {
      mockExtractPlaylistId.mockReturnValue('PLtest');
      mockExtractSpotifyId.mockReturnValue(null);
      mockVerifyFirebase.mockRejectedValue(new Error('Invalid'));
      mockVerifyGuest.mockRejectedValue(new Error('Invalid'));

      const response = await app.inject({
        method: 'POST',
        url: '/api/playlists/import',
        headers: { authorization: 'Bearer bad-token' },
        payload: { playlistUrl: 'https://music.youtube.com/playlist?list=PLtest', sessionId: VALID_SESSION_ID },
      });

      expect(response.statusCode).toBe(401);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('AUTH_INVALID');
    });

    it('import with sessionId pointing to ended session: returns 400 INVALID_SESSION', async () => {
      mockExtractPlaylistId.mockReturnValue('PLtest');
      mockExtractSpotifyId.mockReturnValue(null);
      mockFetchPlaylistTracks.mockResolvedValue({
        tracks: [{ songTitle: 'Hello', artist: 'Adele', youtubeVideoId: 'vid1' }],
        unparseable: 0,
        totalFetched: 1,
      });
      mockIntersectWithSongs.mockResolvedValue([]);
      mockVerifyFirebase.mockResolvedValue({ uid: 'firebase-user-1' } as any);
      mockFindById.mockResolvedValue({ id: VALID_SESSION_ID, status: 'ended' } as any);

      const response = await app.inject({
        method: 'POST',
        url: '/api/playlists/import',
        headers: { authorization: 'Bearer valid-token' },
        payload: { playlistUrl: 'https://music.youtube.com/playlist?list=PLtest', sessionId: VALID_SESSION_ID },
      });

      expect(response.statusCode).toBe(400);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const error = body['error'] as Record<string, unknown>;
      expect(error['code']).toBe('INVALID_SESSION');
    });

    it('import without sessionId: backward compatible, no auth required, poolStats absent', async () => {
      mockExtractPlaylistId.mockReturnValue('PLtest');
      mockExtractSpotifyId.mockReturnValue(null);
      mockFetchPlaylistTracks.mockResolvedValue({
        tracks: [{ songTitle: 'Hello', artist: 'Adele', youtubeVideoId: 'vid1' }],
        unparseable: 0,
        totalFetched: 1,
      });
      mockIntersectWithSongs.mockResolvedValue([]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/playlists/import',
        payload: { playlistUrl: 'https://music.youtube.com/playlist?list=PLtest' },
      });

      expect(response.statusCode).toBe(200);
      const body = JSON.parse(response.body) as Record<string, unknown>;
      const data = body['data'] as Record<string, unknown>;
      expect(data['poolStats']).toBeUndefined();
      expect(mockAddImportedSongs).not.toHaveBeenCalled();
    });

    it('import with sessionId + valid guest auth: calls addImportedSongs', async () => {
      mockExtractPlaylistId.mockReturnValue('PLtest');
      mockExtractSpotifyId.mockReturnValue(null);
      mockFetchPlaylistTracks.mockResolvedValue({
        tracks: [{ songTitle: 'Hello', artist: 'Adele', youtubeVideoId: 'vid1' }],
        unparseable: 0,
        totalFetched: 1,
      });
      mockIntersectWithSongs.mockResolvedValue([]);
      mockVerifyFirebase.mockRejectedValue(new Error('Not Firebase'));
      mockVerifyGuest.mockResolvedValue({ guestId: 'guest-user-1', sessionId: VALID_SESSION_ID, role: 'guest' as const });
      mockFindById.mockResolvedValue({ id: VALID_SESSION_ID, status: 'lobby' } as any);
      mockAddImportedSongs.mockReturnValue({ newSongs: 0, updatedOverlaps: 0 });
      mockGetPooledSongs.mockReturnValue([]);

      const response = await app.inject({
        method: 'POST',
        url: '/api/playlists/import',
        headers: { authorization: 'Bearer guest-token' },
        payload: { playlistUrl: 'https://music.youtube.com/playlist?list=PLtest', sessionId: VALID_SESSION_ID },
      });

      expect(response.statusCode).toBe(200);
      expect(mockAddImportedSongs).toHaveBeenCalledWith(VALID_SESSION_ID, 'guest-user-1', []);
    });
  });
});
