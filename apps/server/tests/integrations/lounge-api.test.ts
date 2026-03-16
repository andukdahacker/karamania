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

import { createLoungeApiClient, resetForTest } from '../../src/integrations/lounge-api.js';
import type { TvIntegration, NowPlayingEvent, TvConnectionStatus } from '../../src/integrations/tv-integration.js';

describe('lounge-api', () => {
  const originalFetch = globalThis.fetch;

  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
  });

  afterEach(() => {
    globalThis.fetch = originalFetch;
    vi.useRealTimers();
    resetForTest();
  });

  function mockFetchSequence(
    responses: Array<{ ok: boolean; status: number; statusText?: string; body?: unknown; text?: string }>,
  ) {
    let callIndex = 0;
    globalThis.fetch = vi.fn(async () => {
      const resp = responses[callIndex]!;
      callIndex++;
      return {
        ok: resp.ok,
        status: resp.status,
        statusText: resp.statusText ?? '',
        json: async () => resp.body,
        text: async () => resp.text ?? JSON.stringify(resp.body ?? {}),
      } as Response;
    });
  }

  describe('TvIntegration interface compliance', () => {
    it('creates a client implementing TvIntegration', () => {
      const client: TvIntegration = createLoungeApiClient();
      expect(typeof client.connect).toBe('function');
      expect(typeof client.disconnect).toBe('function');
      expect(typeof client.addToQueue).toBe('function');
      expect(typeof client.onNowPlaying).toBe('function');
      expect(typeof client.onStatusChange).toBe('function');
      expect(typeof client.isConnected).toBe('function');
    });

    it('starts disconnected', () => {
      const client = createLoungeApiClient();
      expect(client.isConnected()).toBe(false);
    });
  });

  describe('connect', () => {
    it('connects with valid pairing code', async () => {
      // Mock: get_screen -> bind -> long-poll (hold)
      mockFetchSequence([
        // get_screen
        {
          ok: true,
          status: 200,
          body: { screen: { screenId: 'screen-123', loungeToken: 'token-abc' } },
        },
        // bind
        {
          ok: true,
          status: 200,
          text: '42\n[[0,["c","SID123","",8]],[1,["S","gsid456"]]]\n',
        },
        // long-poll (keep-alive — will be aborted on disconnect)
        {
          ok: true,
          status: 200,
          text: '2\n[]\n',
        },
      ]);

      const client = createLoungeApiClient();
      const statuses: TvConnectionStatus[] = [];
      client.onStatusChange((status) => statuses.push(status));

      await client.connect('ABC123');

      expect(client.isConnected()).toBe(true);
      expect(statuses).toContain('connecting');
      expect(statuses).toContain('connected');
    });

    it('throws on invalid pairing code (404)', async () => {
      mockFetchSequence([
        { ok: false, status: 404, statusText: 'Not Found' },
      ]);

      const client = createLoungeApiClient();
      await expect(client.connect('INVALID')).rejects.toThrow('Invalid pairing code');
      expect(client.isConnected()).toBe(false);
    });

    it('throws on invalid pairing code (400)', async () => {
      mockFetchSequence([
        { ok: false, status: 400, statusText: 'Bad Request' },
      ]);

      const client = createLoungeApiClient();
      await expect(client.connect('BAD')).rejects.toThrow('Invalid pairing code');
    });

    it('retries on 429 then succeeds', async () => {
      mockFetchSequence([
        // get_screen: 429 first
        { ok: false, status: 429, statusText: 'Too Many Requests' },
        // get_screen: success
        {
          ok: true,
          status: 200,
          body: { screen: { screenId: 'screen-123', loungeToken: 'token-abc' } },
        },
        // bind
        {
          ok: true,
          status: 200,
          text: '42\n[[0,["c","SID123","",8]],[1,["S","gsid456"]]]\n',
        },
        // long-poll
        {
          ok: true,
          status: 200,
          text: '2\n[]\n',
        },
      ]);

      const client = createLoungeApiClient();
      await client.connect('ABC123');
      expect(client.isConnected()).toBe(true);
      expect(globalThis.fetch).toHaveBeenCalledTimes(4);
    });
  });

  describe('disconnect', () => {
    it('disconnects cleanly', async () => {
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: { screen: { screenId: 'screen-123', loungeToken: 'token-abc' } },
        },
        {
          ok: true,
          status: 200,
          text: '42\n[[0,["c","SID123","",8]],[1,["S","gsid456"]]]\n',
        },
        { ok: true, status: 200, text: '2\n[]\n' },
      ]);

      const client = createLoungeApiClient();
      const statuses: TvConnectionStatus[] = [];
      client.onStatusChange((status) => statuses.push(status));

      await client.connect('ABC123');
      await client.disconnect();

      expect(client.isConnected()).toBe(false);
      expect(statuses).toContain('disconnected');
    });
  });

  describe('addToQueue', () => {
    it('throws when not connected', async () => {
      const client = createLoungeApiClient();
      await expect(client.addToQueue('video123')).rejects.toThrow('Not connected to TV');
    });

    it('sends addVideo command when connected', async () => {
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: { screen: { screenId: 'screen-123', loungeToken: 'token-abc' } },
        },
        {
          ok: true,
          status: 200,
          text: '42\n[[0,["c","SID123","",8]],[1,["S","gsid456"]]]\n',
        },
        { ok: true, status: 200, text: '2\n[]\n' },
        // addToQueue response
        { ok: true, status: 200, text: '' },
      ]);

      const client = createLoungeApiClient();
      await client.connect('ABC123');
      await client.addToQueue('dQw4w9WgXcQ');

      // Find the addToQueue POST call (the one with method POST after the initial bind)
      const calls = (globalThis.fetch as ReturnType<typeof vi.fn>).mock.calls;
      // At least 4 calls: get_screen, bind, long-poll, addVideo
      expect(calls.length).toBeGreaterThanOrEqual(4);
      // Find the POST call to /bc/bind that is NOT the initial bind (has req0__sc or req0_videoId)
      const addVideoCall = calls.find(
        (call) => {
          const url = call[0] as string;
          const opts = call[1] as { method?: string; body?: string } | undefined;
          return url.includes('/bc/bind') && opts?.method === 'POST' && opts?.body?.includes('addVideo');
        },
      );
      expect(addVideoCall).toBeDefined();
    });
  });

  describe('onNowPlaying', () => {
    it('invokes callback when nowPlaying event received', async () => {
      mockFetchSequence([
        {
          ok: true,
          status: 200,
          body: { screen: { screenId: 'screen-123', loungeToken: 'token-abc' } },
        },
        {
          ok: true,
          status: 200,
          text: '42\n[[0,["c","SID123","",8]],[1,["S","gsid456"]]]\n',
        },
        // Long-poll returns nowPlaying event
        {
          ok: true,
          status: 200,
          text: '60\n[[2,["nowPlaying",{"videoId":"vid123","title":"Test Song","state":"1"}]]]\n',
        },
        // Next long-poll (empty)
        {
          ok: true,
          status: 200,
          text: '2\n[]\n',
        },
      ]);

      const client = createLoungeApiClient();
      const events: NowPlayingEvent[] = [];
      client.onNowPlaying((event) => events.push(event));

      await client.connect('ABC123');

      // Wait for the long-poll to process
      await vi.advanceTimersByTimeAsync(100);

      expect(events.length).toBeGreaterThanOrEqual(1);
      expect(events[0]).toEqual({
        videoId: 'vid123',
        title: 'Test Song',
        state: 'playing',
      });
    });
  });

  describe('reconnection', () => {
    it('fires reconnecting status on connection drop', async () => {
      let pollCallCount = 0;
      globalThis.fetch = vi.fn(async (url: string | URL | Request) => {
        const urlStr = typeof url === 'string' ? url : url.toString();

        if (urlStr.includes('get_screen')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({ screen: { screenId: 'screen-123', loungeToken: 'token-abc' } }),
            text: async () => JSON.stringify({ screen: { screenId: 'screen-123', loungeToken: 'token-abc' } }),
          } as Response;
        }

        if (urlStr.includes('/bc/bind') && !urlStr.includes('RID=rpc')) {
          return {
            ok: true,
            status: 200,
            json: async () => ({}),
            text: async () => '42\n[[0,["c","SID123","",8]],[1,["S","gsid456"]]]\n',
          } as Response;
        }

        // Long-poll: first call succeeds, second fails to trigger reconnection
        pollCallCount++;
        if (pollCallCount === 1) {
          return {
            ok: true,
            status: 200,
            json: async () => ({}),
            text: async () => '2\n[]\n',
          } as Response;
        }
        throw new Error('Connection dropped');
      });

      const client = createLoungeApiClient();
      const statuses: TvConnectionStatus[] = [];
      client.onStatusChange((status) => statuses.push(status));

      await client.connect('ABC123');

      // Let the event loop run and hit the error
      await vi.advanceTimersByTimeAsync(2000);

      expect(statuses).toContain('reconnecting');
    });
  });
});
