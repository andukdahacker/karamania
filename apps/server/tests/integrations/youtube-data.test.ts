import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

import { extractPlaylistId, fetchPlaylistTracks } from '../../src/integrations/youtube-data.js';

describe('extractPlaylistId', () => {
  it('extracts ID from music.youtube.com playlist URL', () => {
    expect(extractPlaylistId('https://music.youtube.com/playlist?list=PLabc123')).toBe('PLabc123');
  });

  it('extracts ID from music.youtube.com with extra params', () => {
    expect(extractPlaylistId('https://music.youtube.com/playlist?list=PLabc123&si=xyz')).toBe('PLabc123');
  });

  it('extracts ID from www.youtube.com playlist URL', () => {
    expect(extractPlaylistId('https://www.youtube.com/playlist?list=PLdef456')).toBe('PLdef456');
  });

  it('extracts ID from youtube.com playlist URL (no www)', () => {
    expect(extractPlaylistId('https://youtube.com/playlist?list=PLghi789')).toBe('PLghi789');
  });

  it('returns null for YouTube video URL', () => {
    expect(extractPlaylistId('https://www.youtube.com/watch?v=dQw4w9WgXcQ')).toBeNull();
  });

  it('returns null for YouTube channel URL', () => {
    expect(extractPlaylistId('https://www.youtube.com/channel/UCxyz')).toBeNull();
  });

  it('returns null for non-YouTube URL', () => {
    expect(extractPlaylistId('https://open.spotify.com/playlist/abc123')).toBeNull();
  });

  it('returns null for invalid URL', () => {
    expect(extractPlaylistId('not-a-url')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(extractPlaylistId('')).toBeNull();
  });

  it('returns null for playlist URL without list param', () => {
    expect(extractPlaylistId('https://music.youtube.com/playlist')).toBeNull();
  });
});

describe('fetchPlaylistTracks', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
  });

  function mockFetch(responses: Array<{ ok: boolean; status: number; statusText?: string; body?: unknown }>) {
    let callIndex = 0;
    globalThis.fetch = vi.fn(async () => {
      const resp = responses[callIndex]!;
      callIndex++;
      return {
        ok: resp.ok,
        status: resp.status,
        statusText: resp.statusText ?? '',
        json: async () => resp.body,
      } as Response;
    });
  }

  it('fetches single page of tracks', async () => {
    mockFetch([{
      ok: true,
      status: 200,
      body: {
        items: [
          { snippet: { title: 'Queen - Bohemian Rhapsody', resourceId: { videoId: 'vid1' } } },
          { snippet: { title: 'Adele - Hello', resourceId: { videoId: 'vid2' } } },
        ],
      },
    }]);

    const result = await fetchPlaylistTracks('PLtest', 'api-key');

    expect(result.tracks).toHaveLength(2);
    expect(result.tracks[0]).toEqual({
      songTitle: 'Bohemian Rhapsody',
      artist: 'Queen',
      youtubeVideoId: 'vid1',
    });
    expect(result.tracks[1]).toEqual({
      songTitle: 'Hello',
      artist: 'Adele',
      youtubeVideoId: 'vid2',
    });
    expect(result.totalFetched).toBe(2);
    expect(result.unparseable).toBe(0);
  });

  it('handles multi-page pagination', async () => {
    mockFetch([
      {
        ok: true,
        status: 200,
        body: {
          items: [{ snippet: { title: 'Queen - Bohemian Rhapsody', resourceId: { videoId: 'vid1' } } }],
          nextPageToken: 'page2',
        },
      },
      {
        ok: true,
        status: 200,
        body: {
          items: [{ snippet: { title: 'Adele - Hello', resourceId: { videoId: 'vid2' } } }],
        },
      },
    ]);

    const result = await fetchPlaylistTracks('PLtest', 'api-key');

    expect(result.tracks).toHaveLength(2);
    expect(result.totalFetched).toBe(2);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('handles empty playlist', async () => {
    mockFetch([{
      ok: true,
      status: 200,
      body: { items: [] },
    }]);

    const result = await fetchPlaylistTracks('PLempty', 'api-key');

    expect(result.tracks).toHaveLength(0);
    expect(result.totalFetched).toBe(0);
    expect(result.unparseable).toBe(0);
  });

  it('counts unparseable titles', async () => {
    mockFetch([{
      ok: true,
      status: 200,
      body: {
        items: [
          { snippet: { title: 'Queen - Bohemian Rhapsody', resourceId: { videoId: 'vid1' } } },
          { snippet: { title: 'Just Some Random Text', resourceId: { videoId: 'vid2' } } },
        ],
      },
    }]);

    const result = await fetchPlaylistTracks('PLtest', 'api-key');

    expect(result.tracks).toHaveLength(1);
    expect(result.unparseable).toBe(1);
    expect(result.totalFetched).toBe(2);
  });

  it('throws on non-retryable API error (403)', async () => {
    mockFetch([{
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    }]);

    await expect(fetchPlaylistTracks('PLtest', 'api-key')).rejects.toThrow('YouTube API error: 403 Forbidden');
  });

  it('throws "not found" error on 404 (playlist does not exist)', async () => {
    mockFetch([{
      ok: false,
      status: 404,
      statusText: 'Not Found',
    }]);

    await expect(fetchPlaylistTracks('PLbadid', 'api-key')).rejects.toThrow('Playlist not found or is private');
  });

  it('retries on 429 and succeeds', async () => {
    mockFetch([
      { ok: false, status: 429, statusText: 'Too Many Requests' },
      {
        ok: true,
        status: 200,
        body: {
          items: [{ snippet: { title: 'Queen - Bohemian Rhapsody', resourceId: { videoId: 'vid1' } } }],
        },
      },
    ]);

    const result = await fetchPlaylistTracks('PLtest', 'api-key');

    expect(result.tracks).toHaveLength(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('retries on 500 and succeeds', async () => {
    mockFetch([
      { ok: false, status: 500, statusText: 'Internal Server Error' },
      {
        ok: true,
        status: 200,
        body: {
          items: [{ snippet: { title: 'Adele - Hello', resourceId: { videoId: 'vid1' } } }],
        },
      },
    ]);

    const result = await fetchPlaylistTracks('PLtest', 'api-key');

    expect(result.tracks).toHaveLength(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws after max retries on persistent 429', { timeout: 15000 }, async () => {
    mockFetch([
      { ok: false, status: 429, statusText: 'Too Many Requests' },
      { ok: false, status: 429, statusText: 'Too Many Requests' },
      { ok: false, status: 429, statusText: 'Too Many Requests' },
    ]);

    await expect(fetchPlaylistTracks('PLtest', 'api-key')).rejects.toThrow('Failed after 3 retries');
  });
});
