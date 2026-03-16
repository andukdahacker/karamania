import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { extractPlaylistId, getClientCredentialsToken, fetchPlaylistTracks, resetTokenCache } from '../../src/integrations/spotify-data.js';

describe('spotify-data', () => {
  afterEach(() => {
    resetTokenCache();
    vi.restoreAllMocks();
  });

  describe('extractPlaylistId', () => {
    it('extracts ID from standard Spotify playlist URL', () => {
      expect(extractPlaylistId('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M'))
        .toBe('37i9dQZF1DXcBWIGoYBM5M');
    });

    it('extracts ID from URL with query params', () => {
      expect(extractPlaylistId('https://open.spotify.com/playlist/37i9dQZF1DXcBWIGoYBM5M?si=abc123'))
        .toBe('37i9dQZF1DXcBWIGoYBM5M');
    });

    it('extracts ID from URL without open. prefix', () => {
      expect(extractPlaylistId('https://spotify.com/playlist/abc123'))
        .toBe('abc123');
    });

    it('returns null for track URL', () => {
      expect(extractPlaylistId('https://open.spotify.com/track/abc123')).toBeNull();
    });

    it('returns null for album URL', () => {
      expect(extractPlaylistId('https://open.spotify.com/album/abc123')).toBeNull();
    });

    it('returns null for artist URL', () => {
      expect(extractPlaylistId('https://open.spotify.com/artist/abc123')).toBeNull();
    });

    it('returns null for user profile URL', () => {
      expect(extractPlaylistId('https://open.spotify.com/user/abc123')).toBeNull();
    });

    it('returns null for non-Spotify URL', () => {
      expect(extractPlaylistId('https://music.youtube.com/playlist?list=PLtest')).toBeNull();
    });

    it('returns null for invalid URL', () => {
      expect(extractPlaylistId('not-a-url')).toBeNull();
    });

    it('returns null for empty string', () => {
      expect(extractPlaylistId('')).toBeNull();
    });
  });

  describe('getClientCredentialsToken', () => {
    it('makes correct POST to Spotify accounts API', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ access_token: 'test-token', token_type: 'bearer', expires_in: 3600 }), { status: 200 }),
      );

      const result = await getClientCredentialsToken('client-id', 'client-secret');

      expect(mockFetch).toHaveBeenCalledWith('https://accounts.spotify.com/api/token', {
        method: 'POST',
        headers: {
          'Authorization': `Basic ${Buffer.from('client-id:client-secret').toString('base64')}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: 'grant_type=client_credentials',
      });
      expect(result.accessToken).toBe('test-token');
      expect(result.expiresAt).toBeGreaterThan(Date.now());
    });

    it('caches token and returns cached on subsequent calls', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response(JSON.stringify({ access_token: 'test-token', token_type: 'bearer', expires_in: 3600 }), { status: 200 }),
      );

      await getClientCredentialsToken('client-id', 'client-secret');
      await getClientCredentialsToken('client-id', 'client-secret');

      expect(mockFetch).toHaveBeenCalledTimes(1);
    });

    it('refreshes token when expired minus buffer', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch')
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'token-1', token_type: 'bearer', expires_in: 1 }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ access_token: 'token-2', token_type: 'bearer', expires_in: 3600 }), { status: 200 }),
        );

      const first = await getClientCredentialsToken('client-id', 'client-secret');
      expect(first.accessToken).toBe('token-1');

      // expires_in=1 means expiresAt is ~1s from now, minus 60s buffer means it's already expired
      const second = await getClientCredentialsToken('client-id', 'client-secret');
      expect(second.accessToken).toBe('token-2');
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });

    it('throws on auth error', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValue(
        new Response('Unauthorized', { status: 401, statusText: 'Unauthorized' }),
      );

      await expect(getClientCredentialsToken('bad-id', 'bad-secret'))
        .rejects.toThrow('Spotify auth error: 401 Unauthorized');
    });
  });

  describe('fetchPlaylistTracks', () => {
    beforeEach(() => {
      // Mock token fetch
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ access_token: 'test-token', token_type: 'bearer', expires_in: 3600 }), { status: 200 }),
      );
    });

    it('fetches single page of tracks', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch');
      // Token already mocked in beforeEach, add tracks response
      mockFetch.mockResolvedValueOnce(
        new Response(JSON.stringify({
          items: [
            { track: { name: 'Hello', artists: [{ name: 'Adele' }], external_urls: { spotify: 'url' }, is_local: false } },
            { track: { name: 'Rolling in the Deep', artists: [{ name: 'Adele' }], external_urls: { spotify: 'url2' }, is_local: false } },
          ],
          next: null,
          total: 2,
        }), { status: 200 }),
      );

      const result = await fetchPlaylistTracks('test-id', 'client-id', 'client-secret');

      expect(result.tracks).toHaveLength(2);
      expect(result.tracks[0]).toEqual({ songTitle: 'Hello', artist: 'Adele', youtubeVideoId: '' });
      expect(result.totalFetched).toBe(2);
      expect(result.unparseable).toBe(0);
    });

    it('handles multi-page pagination', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch');
      mockFetch
        .mockResolvedValueOnce(
          new Response(JSON.stringify({
            items: [{ track: { name: 'Song 1', artists: [{ name: 'Artist 1' }], external_urls: { spotify: 'url' }, is_local: false } }],
            next: 'https://api.spotify.com/v1/playlists/test/tracks?offset=100',
            total: 2,
          }), { status: 200 }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({
            items: [{ track: { name: 'Song 2', artists: [{ name: 'Artist 2' }], external_urls: { spotify: 'url' }, is_local: false } }],
            next: null,
            total: 2,
          }), { status: 200 }),
        );

      const result = await fetchPlaylistTracks('test-id', 'client-id', 'client-secret');

      expect(result.tracks).toHaveLength(2);
      expect(result.tracks[0]!.songTitle).toBe('Song 1');
      expect(result.tracks[1]!.songTitle).toBe('Song 2');
    });

    it('handles empty playlist', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [], next: null, total: 0 }), { status: 200 }),
      );

      const result = await fetchPlaylistTracks('empty-id', 'client-id', 'client-secret');

      expect(result.tracks).toHaveLength(0);
      expect(result.totalFetched).toBe(0);
    });

    it('throws error with private keyword for 403', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Forbidden', { status: 403, statusText: 'Forbidden' }),
      );

      await expect(fetchPlaylistTracks('private-id', 'client-id', 'client-secret'))
        .rejects.toThrow('private');
    });

    it('throws for 404 not found', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response('Not Found', { status: 404, statusText: 'Not Found' }),
      );

      await expect(fetchPlaylistTracks('missing-id', 'client-id', 'client-secret'))
        .rejects.toThrow('Spotify playlist not found');
    });

    it('retries on 429 with Retry-After header', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch');
      mockFetch
        .mockResolvedValueOnce(
          new Response('Rate limited', {
            status: 429,
            statusText: 'Too Many Requests',
            headers: { 'Retry-After': '1' },
          }),
        )
        .mockResolvedValueOnce(
          new Response(JSON.stringify({
            items: [{ track: { name: 'Song', artists: [{ name: 'Artist' }], external_urls: { spotify: 'url' }, is_local: false } }],
            next: null,
            total: 1,
          }), { status: 200 }),
        );

      const result = await fetchPlaylistTracks('test-id', 'client-id', 'client-secret');
      expect(result.tracks).toHaveLength(1);
    });

    it('retries on 5xx server errors', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch');
      mockFetch
        .mockResolvedValueOnce(new Response('Server Error', { status: 500, statusText: 'Internal Server Error' }))
        .mockResolvedValueOnce(
          new Response(JSON.stringify({
            items: [{ track: { name: 'Song', artists: [{ name: 'Artist' }], external_urls: { spotify: 'url' }, is_local: false } }],
            next: null,
            total: 1,
          }), { status: 200 }),
        );

      const result = await fetchPlaylistTracks('test-id', 'client-id', 'client-secret');
      expect(result.tracks).toHaveLength(1);
    });

    it('skips null tracks (removed/unavailable)', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          items: [
            { track: null },
            { track: { name: 'Valid Song', artists: [{ name: 'Artist' }], external_urls: { spotify: 'url' }, is_local: false } },
          ],
          next: null,
          total: 2,
        }), { status: 200 }),
      );

      const result = await fetchPlaylistTracks('test-id', 'client-id', 'client-secret');
      expect(result.tracks).toHaveLength(1);
      expect(result.tracks[0]!.songTitle).toBe('Valid Song');
    });

    it('skips local tracks', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          items: [
            { track: { name: 'Local Song', artists: [{ name: 'Local Artist' }], external_urls: { spotify: 'url' }, is_local: true } },
            { track: { name: 'Normal Song', artists: [{ name: 'Artist' }], external_urls: { spotify: 'url' }, is_local: false } },
          ],
          next: null,
          total: 2,
        }), { status: 200 }),
      );

      const result = await fetchPlaylistTracks('test-id', 'client-id', 'client-secret');
      expect(result.tracks).toHaveLength(1);
      expect(result.tracks[0]!.songTitle).toBe('Normal Song');
    });

    it('caps at 5 pages (500 tracks) for NFR29 compliance', async () => {
      const mockFetch = vi.spyOn(globalThis, 'fetch');

      // Mock 6 pages, but only 5 should be fetched
      for (let i = 0; i < 5; i++) {
        mockFetch.mockResolvedValueOnce(
          new Response(JSON.stringify({
            items: [{ track: { name: `Song ${i}`, artists: [{ name: 'Artist' }], external_urls: { spotify: 'url' }, is_local: false } }],
            next: `https://api.spotify.com/v1/playlists/test/tracks?offset=${(i + 1) * 100}`,
            total: 600,
          }), { status: 200 }),
        );
      }

      const result = await fetchPlaylistTracks('test-id', 'client-id', 'client-secret');

      expect(result.tracks).toHaveLength(5);
      expect(result.totalFetched).toBe(600);
      // Token fetch (1) + 5 pages = 6 total calls. Should NOT make a 7th call for page 6
      expect(mockFetch).toHaveBeenCalledTimes(6);
    });

    it('uses first artist when track has multiple artists', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          items: [
            { track: { name: 'Collab', artists: [{ name: 'Artist A' }, { name: 'Artist B' }], external_urls: { spotify: 'url' }, is_local: false } },
          ],
          next: null,
          total: 1,
        }), { status: 200 }),
      );

      const result = await fetchPlaylistTracks('test-id', 'client-id', 'client-secret');
      expect(result.tracks[0]!.artist).toBe('Artist A');
    });

    it('sets youtubeVideoId to empty string', async () => {
      vi.spyOn(globalThis, 'fetch').mockResolvedValueOnce(
        new Response(JSON.stringify({
          items: [
            { track: { name: 'Song', artists: [{ name: 'Artist' }], external_urls: { spotify: 'url' }, is_local: false } },
          ],
          next: null,
          total: 1,
        }), { status: 200 }),
      );

      const result = await fetchPlaylistTracks('test-id', 'client-id', 'client-secret');
      expect(result.tracks[0]!.youtubeVideoId).toBe('');
    });
  });
});
