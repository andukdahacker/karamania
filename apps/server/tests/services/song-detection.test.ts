import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config.js', () => ({
  config: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_SECRET: 'test-secret-key-at-least-32-characters-long',
    YOUTUBE_API_KEY: 'test-api-key',
    SPOTIFY_CLIENT_ID: 'test-id',
    SPOTIFY_CLIENT_SECRET: 'test-secret',
    FIREBASE_PROJECT_ID: 'test-project',
    FIREBASE_CLIENT_EMAIL: 'test@test.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: 'test-key',
    NODE_ENV: 'test',
    PORT: 3000,
  },
}));

vi.mock('../../src/persistence/catalog-repository.js', () => ({
  findByYoutubeVideoId: vi.fn(),
}));

vi.mock('../../src/integrations/youtube-data.js', () => ({
  fetchVideoDetails: vi.fn(),
}));

import { detectSong, getCachedDetection, resetDetectionCache } from '../../src/services/song-detection.js';
import { findByYoutubeVideoId } from '../../src/persistence/catalog-repository.js';
import { fetchVideoDetails } from '../../src/integrations/youtube-data.js';
import { createTestCatalogTrack } from '../factories/catalog.js';

const mockFindByVideoId = vi.mocked(findByYoutubeVideoId);
const mockFetchVideoDetails = vi.mocked(fetchVideoDetails);

describe('song-detection', () => {
  beforeEach(() => {
    resetDetectionCache();
    vi.clearAllMocks();
  });

  describe('detectSong', () => {
    it('Tier 1: returns cached detection without API calls', async () => {
      const catalogTrack = createTestCatalogTrack({
        youtube_video_id: 'cached-vid',
        song_title: 'Cached Song',
        artist: 'Cached Artist',
        channel: 'Cached Channel',
      });
      mockFindByVideoId.mockResolvedValueOnce(catalogTrack);

      // First call populates cache
      await detectSong('cached-vid');
      vi.clearAllMocks();

      // Second call should use cache
      const result = await detectSong('cached-vid');

      expect(result).not.toBeNull();
      expect(result!.songTitle).toBe('Cached Song');
      expect(result!.source).toBe('catalog');
      expect(mockFindByVideoId).not.toHaveBeenCalled();
      expect(mockFetchVideoDetails).not.toHaveBeenCalled();
    });

    it('Tier 2: catalog lookup returns without API calls', async () => {
      const catalogTrack = createTestCatalogTrack({
        youtube_video_id: 'catalog-vid',
        song_title: 'Bohemian Rhapsody',
        artist: 'Queen',
        channel: 'Karaoke Channel',
      });
      mockFindByVideoId.mockResolvedValueOnce(catalogTrack);

      const result = await detectSong('catalog-vid');

      expect(result).not.toBeNull();
      expect(result!.videoId).toBe('catalog-vid');
      expect(result!.songTitle).toBe('Bohemian Rhapsody');
      expect(result!.artist).toBe('Queen');
      expect(result!.channel).toBe('Karaoke Channel');
      expect(result!.source).toBe('catalog');
      expect(mockFetchVideoDetails).not.toHaveBeenCalled();
    });

    it('Tier 3 (parsed): API + successful title parse returns api-parsed', async () => {
      mockFindByVideoId.mockResolvedValueOnce(undefined);
      mockFetchVideoDetails.mockResolvedValueOnce(new Map([
        ['api-vid', {
          videoId: 'api-vid',
          title: 'Queen - Bohemian Rhapsody (Karaoke Version)',
          channelTitle: 'Sing King',
          thumbnail: 'https://thumb.jpg',
          duration: 'PT5M55S',
        }],
      ]));

      const result = await detectSong('api-vid');

      expect(result).not.toBeNull();
      expect(result!.videoId).toBe('api-vid');
      expect(result!.songTitle).toBe('Bohemian Rhapsody');
      expect(result!.artist).toBe('Queen');
      expect(result!.channel).toBe('Sing King');
      expect(result!.thumbnail).toBe('https://thumb.jpg');
      expect(result!.source).toBe('api-parsed');
    });

    it('Tier 3 (raw): API + failed title parse returns api-raw', async () => {
      mockFindByVideoId.mockResolvedValueOnce(undefined);
      mockFetchVideoDetails.mockResolvedValueOnce(new Map([
        ['raw-vid', {
          videoId: 'raw-vid',
          title: 'Some Random Video Title',
          channelTitle: 'Random Channel',
          thumbnail: 'https://thumb.jpg',
          duration: 'PT4M00S',
        }],
      ]));

      const result = await detectSong('raw-vid');

      expect(result).not.toBeNull();
      expect(result!.videoId).toBe('raw-vid');
      expect(result!.songTitle).toBe('Some Random Video Title');
      expect(result!.artist).toBe('Random Channel');
      expect(result!.channel).toBe('Random Channel');
      expect(result!.thumbnail).toBe('https://thumb.jpg');
      expect(result!.source).toBe('api-raw');
    });

    it('returns null when API call fails and no cache', async () => {
      mockFindByVideoId.mockResolvedValueOnce(undefined);
      mockFetchVideoDetails.mockRejectedValueOnce(new Error('API failure'));

      const result = await detectSong('fail-vid');

      expect(result).toBeNull();
    });

    it('populates cache after Tier 2 (catalog) detection', async () => {
      const catalogTrack = createTestCatalogTrack({
        youtube_video_id: 'cache-test-vid',
        song_title: 'Cached',
        artist: 'Artist',
      });
      mockFindByVideoId.mockResolvedValueOnce(catalogTrack);

      await detectSong('cache-test-vid');

      const cached = getCachedDetection('cache-test-vid');
      expect(cached).not.toBeUndefined();
      expect(cached!.songTitle).toBe('Cached');
      expect(cached!.source).toBe('catalog');
    });

    it('populates cache after Tier 3 (API) detection', async () => {
      mockFindByVideoId.mockResolvedValueOnce(undefined);
      mockFetchVideoDetails.mockResolvedValueOnce(new Map([
        ['api-cache-vid', {
          videoId: 'api-cache-vid',
          title: 'Adele - Hello',
          channelTitle: 'Sing King',
          thumbnail: 'https://thumb.jpg',
          duration: 'PT4M30S',
        }],
      ]));

      await detectSong('api-cache-vid');

      const cached = getCachedDetection('api-cache-vid');
      expect(cached).not.toBeUndefined();
      expect(cached!.songTitle).toBe('Hello');
      expect(cached!.source).toBe('api-parsed');
    });
  });

  describe('getCachedDetection', () => {
    it('returns undefined for uncached videoId', () => {
      expect(getCachedDetection('unknown')).toBeUndefined();
    });
  });

  describe('resetDetectionCache', () => {
    it('clears all cached detections', async () => {
      const catalogTrack = createTestCatalogTrack({ youtube_video_id: 'clear-vid' });
      mockFindByVideoId.mockResolvedValueOnce(catalogTrack);

      await detectSong('clear-vid');
      expect(getCachedDetection('clear-vid')).not.toBeUndefined();

      resetDetectionCache();
      expect(getCachedDetection('clear-vid')).toBeUndefined();
    });
  });
});
