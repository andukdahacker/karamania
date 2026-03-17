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

import { fetchVideoDetails } from '../../src/integrations/youtube-data.js';

describe('fetchVideoDetails', () => {
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

  it('fetches single video details', async () => {
    mockFetch([{
      ok: true,
      status: 200,
      body: {
        items: [{
          id: 'vid1',
          snippet: {
            title: 'Queen - Bohemian Rhapsody (Karaoke Version)',
            channelTitle: 'Karaoke Channel',
            thumbnails: { medium: { url: 'https://i.ytimg.com/vi/vid1/mqdefault.jpg' } },
          },
          contentDetails: { duration: 'PT5M55S' },
        }],
      },
    }]);

    const result = await fetchVideoDetails(['vid1'], 'api-key');

    expect(result.size).toBe(1);
    expect(result.get('vid1')).toEqual({
      videoId: 'vid1',
      title: 'Queen - Bohemian Rhapsody (Karaoke Version)',
      channelTitle: 'Karaoke Channel',
      thumbnail: 'https://i.ytimg.com/vi/vid1/mqdefault.jpg',
      duration: 'PT5M55S',
    });
  });

  it('fetches batch of multiple video details', async () => {
    mockFetch([{
      ok: true,
      status: 200,
      body: {
        items: [
          {
            id: 'vid1',
            snippet: {
              title: 'Queen - Bohemian Rhapsody',
              channelTitle: 'Channel A',
              thumbnails: { medium: { url: 'https://thumb1.jpg' } },
            },
            contentDetails: { duration: 'PT3M45S' },
          },
          {
            id: 'vid2',
            snippet: {
              title: 'Adele - Hello',
              channelTitle: 'Channel B',
              thumbnails: { medium: { url: 'https://thumb2.jpg' } },
            },
            contentDetails: { duration: 'PT4M30S' },
          },
        ],
      },
    }]);

    const result = await fetchVideoDetails(['vid1', 'vid2'], 'api-key');

    expect(result.size).toBe(2);
    expect(result.get('vid1')!.title).toBe('Queen - Bohemian Rhapsody');
    expect(result.get('vid2')!.title).toBe('Adele - Hello');
  });

  it('omits missing videoIds from result Map', async () => {
    mockFetch([{
      ok: true,
      status: 200,
      body: {
        items: [{
          id: 'vid1',
          snippet: {
            title: 'Queen - Bohemian Rhapsody',
            channelTitle: 'Channel A',
            thumbnails: { medium: { url: 'https://thumb1.jpg' } },
          },
          contentDetails: { duration: 'PT3M45S' },
        }],
      },
    }]);

    const result = await fetchVideoDetails(['vid1', 'vid_missing'], 'api-key');

    expect(result.size).toBe(1);
    expect(result.has('vid1')).toBe(true);
    expect(result.has('vid_missing')).toBe(false);
  });

  it('returns empty Map for empty videoIds array', async () => {
    const result = await fetchVideoDetails([], 'api-key');
    expect(result.size).toBe(0);
  });

  it('retries on 429 and succeeds', async () => {
    mockFetch([
      { ok: false, status: 429, statusText: 'Too Many Requests' },
      {
        ok: true,
        status: 200,
        body: {
          items: [{
            id: 'vid1',
            snippet: {
              title: 'Test Song',
              channelTitle: 'Test Channel',
              thumbnails: { medium: { url: 'https://thumb.jpg' } },
            },
            contentDetails: { duration: 'PT3M00S' },
          }],
        },
      },
    ]);

    const result = await fetchVideoDetails(['vid1'], 'api-key');

    expect(result.size).toBe(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('retries on 5xx and succeeds', async () => {
    mockFetch([
      { ok: false, status: 500, statusText: 'Internal Server Error' },
      {
        ok: true,
        status: 200,
        body: {
          items: [{
            id: 'vid1',
            snippet: {
              title: 'Test Song',
              channelTitle: 'Test Channel',
              thumbnails: { medium: { url: 'https://thumb.jpg' } },
            },
            contentDetails: { duration: 'PT3M00S' },
          }],
        },
      },
    ]);

    const result = await fetchVideoDetails(['vid1'], 'api-key');

    expect(result.size).toBe(1);
    expect(globalThis.fetch).toHaveBeenCalledTimes(2);
  });

  it('throws after max retries on persistent 429', { timeout: 15000 }, async () => {
    mockFetch([
      { ok: false, status: 429, statusText: 'Too Many Requests' },
      { ok: false, status: 429, statusText: 'Too Many Requests' },
      { ok: false, status: 429, statusText: 'Too Many Requests' },
    ]);

    await expect(fetchVideoDetails(['vid1'], 'api-key')).rejects.toThrow('Failed after 3 retries');
  });

  it('throws on non-retryable error', async () => {
    mockFetch([{
      ok: false,
      status: 403,
      statusText: 'Forbidden',
    }]);

    await expect(fetchVideoDetails(['vid1'], 'api-key')).rejects.toThrow('YouTube API error: 403 Forbidden');
  });

  it('sends correct URL with comma-separated IDs', async () => {
    mockFetch([{
      ok: true,
      status: 200,
      body: { items: [] },
    }]);

    await fetchVideoDetails(['vid1', 'vid2', 'vid3'], 'my-api-key');

    expect(globalThis.fetch).toHaveBeenCalledTimes(1);
    const calledUrl = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls[0]![0] as string;
    expect(calledUrl).toContain('id=vid1%2Cvid2%2Cvid3');
    expect(calledUrl).toContain('key=my-api-key');
    expect(calledUrl).toContain('part=snippet%2CcontentDetails');
  });
});
