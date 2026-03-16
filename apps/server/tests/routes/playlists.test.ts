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

const mockIntersectWithSongs = vi.fn();

vi.mock('../../src/persistence/catalog-repository.js', () => ({
  intersectWithSongs: mockIntersectWithSongs,
}));

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

    it('handles empty playlist', async () => {
      mockExtractPlaylistId.mockReturnValue('PLempty');
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
  });
});
