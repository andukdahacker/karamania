import type { TvIntegration, NowPlayingEvent, TvConnectionStatus } from './tv-integration.js';
import { randomUUID } from 'node:crypto';

const LOUNGE_BASE = 'https://www.youtube.com/api/lounge';
const MAX_RETRIES = 3;
const RECONNECT_DELAYS = [1000, 2000, 4000, 8000, 16000, 29000]; // 60s total

interface LoungeSession {
  screenId: string;
  loungeToken: string;
  sid: string;
  gsessionid: string;
}

function randomZx(): string {
  return Math.random().toString(36).substring(2, 14);
}

function parseChunkedResponse(text: string): Array<[number, unknown[]]> {
  // Lounge API returns length-prefixed chunks:
  // 123\n[[0,["c","SID_VALUE","",8]],...]\n
  const results: Array<[number, unknown[]]> = [];
  const lines = text.split('\n');
  let i = 0;
  while (i < lines.length) {
    const line = lines[i]!.trim();
    if (!line) {
      i++;
      continue;
    }
    // If it's a number, next line(s) contain the JSON
    if (/^\d+$/.test(line)) {
      i++;
      if (i < lines.length) {
        try {
          const parsed = JSON.parse(lines[i]!) as Array<[number, unknown[]]>;
          results.push(...parsed);
        } catch {
          // Skip unparseable chunks
        }
        i++;
      }
    } else {
      // Try parsing directly
      try {
        const parsed = JSON.parse(line) as Array<[number, unknown[]]>;
        results.push(...parsed);
      } catch {
        // Skip
      }
      i++;
    }
  }
  return results;
}

class LoungeApiClient implements TvIntegration {
  private session: LoungeSession | null = null;
  private deviceId: string = randomUUID();
  private reqCount = 0;
  private aid = 0;
  private connected = false;
  private abortController: AbortController | null = null;
  private nowPlayingCallback: ((event: NowPlayingEvent) => void) | null = null;
  private statusCallback: ((status: TvConnectionStatus) => void) | null = null;
  private reconnecting = false;

  async connect(pairingCode: string): Promise<void> {
    this.fireStatusChange('connecting');

    // Step 1: Get screen from pairing code
    const { screenId, loungeToken } = await this.getScreen(pairingCode);

    // Step 2: Bind to establish session
    const { sid, gsessionid } = await this.bind(loungeToken);

    this.session = { screenId, loungeToken, sid, gsessionid };
    this.connected = true;
    this.reqCount = 0;
    this.aid = 0;
    this.fireStatusChange('connected');

    // Step 3: Start long-poll event loop
    this.startEventLoop();
  }

  async disconnect(): Promise<void> {
    this.connected = false;
    this.reconnecting = false;
    this.abortController?.abort();
    this.abortController = null;
    this.session = null;
    this.fireStatusChange('disconnected');
  }

  async addToQueue(videoId: string): Promise<void> {
    if (!this.connected || !this.session) {
      throw new Error('Not connected to TV');
    }

    this.reqCount++;
    const body = new URLSearchParams({
      SID: this.session.sid,
      gsessionid: this.session.gsessionid,
      RID: String(this.reqCount),
      req0__sc: 'addVideo',
      req0_videoId: videoId,
      count: '1',
    });

    const response = await fetch(`${LOUNGE_BASE}/bc/bind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`addToQueue failed: ${response.status} ${response.statusText}`);
    }
  }

  onNowPlaying(callback: (event: NowPlayingEvent) => void): void {
    this.nowPlayingCallback = callback;
  }

  onStatusChange(callback: (status: TvConnectionStatus) => void): void {
    this.statusCallback = callback;
  }

  isConnected(): boolean {
    return this.connected;
  }

  private fireStatusChange(status: TvConnectionStatus): void {
    this.statusCallback?.(status);
  }

  private async getScreen(pairingCode: string): Promise<{ screenId: string; loungeToken: string }> {
    const body = new URLSearchParams({ pairing_code: pairingCode });

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
      const response = await fetch(`${LOUNGE_BASE}/pairing/get_screen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: body.toString(),
        signal: AbortSignal.timeout(5000),
      });

      if (response.ok) {
        const data = (await response.json()) as { screen: { screenId: string; loungeToken: string } };
        return { screenId: data.screen.screenId, loungeToken: data.screen.loungeToken };
      }

      if (response.status === 404 || response.status === 400) {
        throw new Error('Invalid pairing code');
      }

      if (response.status === 429 || response.status >= 500) {
        const delay = Math.pow(2, attempt) * 1000;
        await new Promise((resolve) => setTimeout(resolve, delay));
        continue;
      }

      throw new Error(`Pairing failed: ${response.status} ${response.statusText}`);
    }

    throw new Error(`Pairing failed after ${MAX_RETRIES} retries`);
  }

  private async bind(loungeToken: string): Promise<{ sid: string; gsessionid: string }> {
    const body = new URLSearchParams({
      loungeIdToken: loungeToken,
      device: 'REMOTE_CONTROL',
      id: this.deviceId,
      VER: '8',
      CVER: '1',
      zx: randomZx(),
    });

    const response = await fetch(`${LOUNGE_BASE}/bc/bind`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(10000),
    });

    if (!response.ok) {
      throw new Error(`Bind failed: ${response.status} ${response.statusText}`);
    }

    const text = await response.text();
    const chunks = parseChunkedResponse(text);

    let sid = '';
    let gsessionid = '';

    for (const [, entry] of chunks) {
      if (Array.isArray(entry) && entry.length >= 2) {
        if (entry[0] === 'c' && typeof entry[1] === 'string') {
          sid = entry[1];
        }
        if (entry[0] === 'S' && typeof entry[1] === 'string') {
          gsessionid = entry[1];
        }
      }
    }

    if (!sid || !gsessionid) {
      throw new Error('Failed to obtain session identifiers from bind response');
    }

    return { sid, gsessionid };
  }

  private startEventLoop(): void {
    this.abortController = new AbortController();
    this.pollEvents().catch(() => {
      // Error handled inside pollEvents via reconnection
    });
  }

  private async pollEvents(): Promise<void> {
    while (this.connected && this.session) {
      try {
        const params = new URLSearchParams({
          SID: this.session.sid,
          gsessionid: this.session.gsessionid,
          RID: 'rpc',
          CI: '0',
          TYPE: 'xmlhttp',
          AID: String(this.aid),
        });

        const signal = this.abortController?.signal;
        if (!signal) return;

        const response = await fetch(`${LOUNGE_BASE}/bc/bind?${params.toString()}`, {
          method: 'GET',
          signal,
        });

        if (!response.ok) {
          throw new Error(`Long-poll failed: ${response.status}`);
        }

        const text = await response.text();
        const chunks = parseChunkedResponse(text);

        for (const [id, entry] of chunks) {
          this.aid = Math.max(this.aid, id + 1);
          this.processEvent(entry);
        }
      } catch (error) {
        if (!this.connected) return; // Clean disconnect
        if ((error as Error).name === 'AbortError') return;

        // Connection dropped — attempt reconnection
        await this.attemptReconnection();
        return;
      }
    }
  }

  private processEvent(entry: unknown[]): void {
    if (!Array.isArray(entry) || entry.length < 2) return;

    const eventName = entry[0] as string;

    if (eventName === 'nowPlaying' || eventName === 'onStateChange') {
      const data = entry[1] as Record<string, string> | undefined;
      if (!data) return;

      const videoId = data['videoId'] ?? data['videoID'];
      if (!videoId) return;

      const stateMap: Record<string, NowPlayingEvent['state']> = {
        '1': 'playing',
        '2': 'paused',
        '3': 'buffering',
        '-1': 'idle',
      };

      const event: NowPlayingEvent = {
        videoId,
        title: data['title'],
        state: stateMap[data['state'] ?? ''] ?? 'idle',
      };

      this.nowPlayingCallback?.(event);
    }
  }

  private async attemptReconnection(): Promise<void> {
    if (this.reconnecting || !this.session) return;
    this.reconnecting = true;
    this.fireStatusChange('reconnecting');

    const { screenId, loungeToken } = this.session;

    for (const delay of RECONNECT_DELAYS) {
      if (!this.reconnecting) return; // disconnect() called during reconnection

      await new Promise((resolve) => setTimeout(resolve, delay));

      if (!this.reconnecting) return;

      try {
        // Try refreshing lounge token first
        let currentToken = loungeToken;
        try {
          currentToken = await this.refreshLoungeToken(screenId);
        } catch {
          // Use existing token
        }

        // Re-bind
        const { sid, gsessionid } = await this.bind(currentToken);
        this.session = { screenId, loungeToken: currentToken, sid, gsessionid };
        this.reconnecting = false;
        this.connected = true;
        this.fireStatusChange('connected');
        this.startEventLoop();
        return;
      } catch {
        // Try next delay
        continue;
      }
    }

    // All retries exhausted
    this.reconnecting = false;
    this.connected = false;
    this.session = null;
    this.fireStatusChange('disconnected');
  }

  private async refreshLoungeToken(screenId: string): Promise<string> {
    const body = new URLSearchParams({ screen_ids: screenId });

    const response = await fetch(`${LOUNGE_BASE}/pairing/get_lounge_token_batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
      signal: AbortSignal.timeout(5000),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = (await response.json()) as { screens: Array<{ loungeToken: string }> };
    const token = data.screens[0]?.loungeToken;
    if (!token) {
      throw new Error('No token in refresh response');
    }
    return token;
  }
}

export function createLoungeApiClient(): TvIntegration {
  return new LoungeApiClient();
}

// No module-level state to reset — each createLoungeApiClient() call returns an independent instance.
// resetForTest exported for pattern consistency with other modules.
export function resetForTest(): void {}
