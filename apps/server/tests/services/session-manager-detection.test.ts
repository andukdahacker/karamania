import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import type { TvIntegration, NowPlayingEvent, TvConnectionStatus } from '../../src/integrations/tv-integration.js';

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

vi.mock('../../src/db/connection.js', () => ({ db: {} }));
vi.mock('../../src/services/party-code.js', () => ({ generateUniquePartyCode: vi.fn() }));

vi.mock('../../src/persistence/session-repository.js', () => ({
  create: vi.fn(),
  addParticipant: vi.fn(),
  addParticipantIfNotExists: vi.fn(),
  getParticipants: vi.fn(),
  findById: vi.fn(),
  updateStatus: vi.fn(),
  updateHost: vi.fn(),
  updateDjState: vi.fn(),
  removeParticipant: vi.fn(),
  writeEventStream: vi.fn(),
  incrementParticipationScore: vi.fn().mockResolvedValue(undefined),
  getParticipantScore: vi.fn(),
  updateTopAward: vi.fn().mockResolvedValue(undefined),
  findActiveSessions: vi.fn(),
}));

vi.mock('../../src/dj-engine/machine.js', () => ({
  createDJContext: vi.fn(),
  processTransition: vi.fn(),
}));

vi.mock('../../src/dj-engine/serializer.js', () => ({
  deserializeDJContext: vi.fn(),
  serializeDJContext: (ctx: unknown) => ctx,
}));

vi.mock('../../src/services/dj-state-store.js', () => ({
  getSessionDjState: vi.fn(),
  setSessionDjState: vi.fn(),
  removeSessionDjState: vi.fn(),
}));

vi.mock('../../src/services/timer-scheduler.js', () => ({
  scheduleSessionTimer: vi.fn(),
  cancelSessionTimer: vi.fn(),
  pauseSessionTimer: vi.fn(),
  resumeSessionTimer: vi.fn(),
}));

const mockGetIO = vi.fn();
vi.mock('../../src/services/dj-broadcaster.js', () => ({
  broadcastDjState: vi.fn(),
  broadcastDjPause: vi.fn(),
  broadcastDjResume: vi.fn(),
  broadcastCeremonyAnticipation: vi.fn(),
  broadcastCeremonyReveal: vi.fn(),
  broadcastCeremonyQuick: vi.fn(),
  broadcastCardDealt: vi.fn(),
  broadcastQuickPickStarted: vi.fn(),
  broadcastSpinWheelStarted: vi.fn(),
  broadcastSpinWheelResult: vi.fn(),
  broadcastModeChanged: vi.fn(),
  getIO: (...args: unknown[]) => mockGetIO(...args),
}));

vi.mock('../../src/services/quick-pick.js', () => ({
  startRound: vi.fn(),
  getRound: vi.fn(),
  resolveByTimeout: vi.fn(),
  clearRound: vi.fn(),
  resetAllRounds: vi.fn(),
}));

vi.mock('../../src/services/spin-wheel.js', () => ({
  startRound: vi.fn(),
  initiateSpin: vi.fn(),
  onSpinComplete: vi.fn(),
  startVetoWindow: vi.fn(),
  handleVeto: vi.fn(),
  resolveRound: vi.fn(),
  autoSpin: vi.fn(),
  getRound: vi.fn(),
  clearRound: vi.fn(),
  resetAllRounds: vi.fn(),
}));

vi.mock('../../src/services/suggestion-engine.js', () => ({
  computeSuggestions: vi.fn(),
}));

const mockMarkSongSung = vi.fn();
vi.mock('../../src/services/song-pool.js', () => ({
  markSongSung: (...args: unknown[]) => mockMarkSongSung(...args),
  clearPool: vi.fn(),
  resetAllPools: vi.fn(),
}));

vi.mock('../../src/services/connection-tracker.js', () => ({
  removeSession: vi.fn(),
  getActiveConnections: vi.fn().mockReturnValue([]),
  trackConnection: vi.fn(),
  trackDisconnection: vi.fn(),
  isUserConnected: vi.fn(),
  getLongestConnected: vi.fn(),
  removeDisconnectedEntry: vi.fn(),
  updateHostStatus: vi.fn(),
  getActiveCount: vi.fn(),
}));

const mockAppendEvent = vi.fn();
vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
  flushEventStream: vi.fn().mockReturnValue([]),
  getEventStream: vi.fn().mockReturnValue([]),
  removeEventStream: vi.fn(),
}));

vi.mock('../../src/services/activity-tracker.js', () => ({ removeSession: vi.fn() }));
vi.mock('../../src/services/streak-tracker.js', () => ({
  clearSessionStreaks: vi.fn(),
  clearUserStreak: vi.fn(),
  clearStreakStore: vi.fn(),
}));
vi.mock('../../src/services/card-dealer.js', () => ({
  dealCard: vi.fn(),
  clearDealtCards: vi.fn(),
}));
vi.mock('../../src/services/participation-scoring.js', () => ({
  calculateScoreIncrement: vi.fn(),
  ACTION_TIER_MAP: {},
}));
vi.mock('../../src/services/award-generator.js', () => ({
  generateAward: vi.fn(),
  AWARD_TEMPLATES: [],
  AwardTone: {},
}));

vi.mock('../../src/integrations/lounge-api.js', () => ({
  createLoungeApiClient: vi.fn(),
  resetForTest: vi.fn(),
}));

const mockDetectSong = vi.fn();
vi.mock('../../src/services/song-detection.js', () => ({
  detectSong: (...args: unknown[]) => mockDetectSong(...args),
  resetDetectionCache: vi.fn(),
}));

vi.mock('../../src/services/capture-trigger.js', () => ({
  shouldEmitCaptureBubble: vi.fn().mockReturnValue(false),
  markBubbleEmitted: vi.fn(),
  clearCaptureTriggerState: vi.fn(),
}));

import { pairTv, setTvFactory, resetAllTvConnections } from '../../src/services/session-manager.js';

function createMockTvIntegration(): TvIntegration & {
  _nowPlayingCallback: ((event: NowPlayingEvent) => void) | null;
  _statusCallback: ((status: TvConnectionStatus) => void) | null;
} {
  let nowPlayingCallback: ((event: NowPlayingEvent) => void) | null = null;
  let statusCallback: ((status: TvConnectionStatus) => void) | null = null;
  let connected = false;

  return {
    _nowPlayingCallback: null,
    _statusCallback: null,
    connect: vi.fn(async () => {
      connected = true;
    }),
    disconnect: vi.fn(async () => {
      connected = false;
    }),
    addToQueue: vi.fn(async () => {}),
    onNowPlaying: vi.fn((cb) => {
      nowPlayingCallback = cb;
    }),
    onStatusChange: vi.fn((cb) => {
      statusCallback = cb;
    }),
    isConnected: vi.fn(() => connected),
    get _nowPlayingCb() {
      return nowPlayingCallback;
    },
    get _statusCb() {
      return statusCallback;
    },
  } as unknown as ReturnType<typeof createMockTvIntegration>;
}

describe('session-manager song detection integration', () => {
  let mockTv: ReturnType<typeof createMockTvIntegration>;
  const mockEmit = vi.fn();
  const mockTo = vi.fn(() => ({ emit: mockEmit }));

  beforeEach(() => {
    vi.clearAllMocks();
    mockTv = createMockTvIntegration();
    setTvFactory(() => mockTv);
    mockGetIO.mockReturnValue({ to: mockTo });
  });

  afterEach(() => {
    resetAllTvConnections();
  });

  function getNowPlayingCallback(): (event: NowPlayingEvent) => void {
    const call = (mockTv.onNowPlaying as ReturnType<typeof vi.fn>).mock.calls[0]!;
    return call[0] as (event: NowPlayingEvent) => void;
  }

  it('emits SONG_DETECTED with full metadata after detection', async () => {
    mockDetectSong.mockResolvedValue({
      videoId: 'vid1',
      songTitle: 'Bohemian Rhapsody',
      artist: 'Queen',
      channel: 'Sing King',
      thumbnail: 'https://thumb.jpg',
      source: 'catalog',
    });

    await pairTv('session-1', 'ABC');
    const callback = getNowPlayingCallback();

    callback({ videoId: 'vid1', title: 'Queen - Bohemian Rhapsody', state: 'playing' });

    // Wait for async detection to complete
    await vi.waitFor(() => {
      expect(mockEmit).toHaveBeenCalledWith('song:detected', {
        videoId: 'vid1',
        songTitle: 'Bohemian Rhapsody',
        artist: 'Queen',
        channel: 'Sing King',
        thumbnail: 'https://thumb.jpg',
        source: 'catalog',
      });
    });
  });

  it('calls markSongSung with detected song data', async () => {
    mockDetectSong.mockResolvedValue({
      videoId: 'vid1',
      songTitle: 'Hello',
      artist: 'Adele',
      channel: 'Sing King',
      thumbnail: null,
      source: 'api-parsed',
    });

    await pairTv('session-1', 'ABC');
    const callback = getNowPlayingCallback();

    callback({ videoId: 'vid1', title: 'Adele - Hello', state: 'playing' });

    await vi.waitFor(() => {
      expect(mockMarkSongSung).toHaveBeenCalledWith('session-1', 'Hello', 'Adele');
    });
  });

  it('does NOT trigger detection for non-playing states', async () => {
    await pairTv('session-1', 'ABC');
    const callback = getNowPlayingCallback();

    callback({ videoId: 'vid1', title: 'Test', state: 'paused' });
    callback({ videoId: 'vid1', title: 'Test', state: 'buffering' });
    callback({ videoId: 'vid1', title: 'Test', state: 'idle' });

    expect(mockDetectSong).not.toHaveBeenCalled();
  });

  it('emits minimal SONG_DETECTED on detection failure', async () => {
    mockDetectSong.mockRejectedValue(new Error('API failure'));

    await pairTv('session-1', 'ABC');
    const callback = getNowPlayingCallback();

    callback({ videoId: 'vid1', title: 'Test Song', state: 'playing' });

    await vi.waitFor(() => {
      expect(mockEmit).toHaveBeenCalledWith('song:detected', {
        videoId: 'vid1',
        songTitle: 'Test Song',
        artist: null,
        channel: null,
        thumbnail: null,
        source: 'api-raw',
      });
    });
  });

  it('always emits TV_NOW_PLAYING immediately regardless of detection', async () => {
    // Slow detection that hasn't resolved yet
    mockDetectSong.mockImplementation(() => new Promise(() => {}));

    await pairTv('session-1', 'ABC');
    const callback = getNowPlayingCallback();

    callback({ videoId: 'vid1', title: 'Test Song', state: 'playing' });

    // TV_NOW_PLAYING should be emitted immediately (synchronously)
    expect(mockEmit).toHaveBeenCalledWith('tv:nowPlaying', {
      videoId: 'vid1',
      title: 'Test Song',
      state: 'playing',
    });
  });

  it('appends song:detected event with title and artist', async () => {
    mockDetectSong.mockResolvedValue({
      videoId: 'vid1',
      songTitle: 'Bohemian Rhapsody',
      artist: 'Queen',
      channel: 'Sing King',
      thumbnail: 'https://thumb.jpg',
      source: 'catalog',
    });

    await pairTv('session-1', 'ABC');
    const callback = getNowPlayingCallback();

    callback({ videoId: 'vid1', title: 'Queen - Bohemian Rhapsody', state: 'playing' });

    await vi.waitFor(() => {
      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'song:detected',
        data: {
          videoId: 'vid1',
          title: 'Bohemian Rhapsody',
          artist: 'Queen',
        },
      }));
    });
  });
});
