import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestDJContext } from '../factories/dj-state.js';
import { DJState } from '../../src/dj-engine/types.js';
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

const mockFindById = vi.fn();
const mockUpdateDjState = vi.fn();
const mockUpdateStatus = vi.fn();
const mockWriteEventStream = vi.fn();
vi.mock('../../src/persistence/session-repository.js', () => ({
  create: vi.fn(),
  addParticipant: vi.fn(),
  addParticipantIfNotExists: vi.fn(),
  getParticipants: vi.fn(),
  findById: (...args: unknown[]) => mockFindById(...args),
  updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  updateHost: vi.fn(),
  updateDjState: (...args: unknown[]) => mockUpdateDjState(...args),
  removeParticipant: vi.fn(),
  writeEventStream: (...args: unknown[]) => mockWriteEventStream(...args),
  incrementParticipationScore: vi.fn().mockResolvedValue(undefined),
  getParticipantScore: vi.fn(),
  updateTopAward: vi.fn().mockResolvedValue(undefined),
  findActiveSessions: vi.fn(),
}));

const mockProcessTransition = vi.fn();
vi.mock('../../src/dj-engine/machine.js', () => ({
  createDJContext: vi.fn(),
  processTransition: (...args: unknown[]) => mockProcessTransition(...args),
}));

vi.mock('../../src/dj-engine/serializer.js', () => ({
  deserializeDJContext: vi.fn(),
  serializeDJContext: (ctx: unknown) => ctx,
}));

const mockSetSessionDjState = vi.fn();
const mockGetSessionDjState = vi.fn();
vi.mock('../../src/services/dj-state-store.js', () => ({
  getSessionDjState: (...args: unknown[]) => mockGetSessionDjState(...args),
  setSessionDjState: (...args: unknown[]) => mockSetSessionDjState(...args),
  removeSessionDjState: vi.fn(),
}));

const mockCancelSessionTimer = vi.fn();
vi.mock('../../src/services/timer-scheduler.js', () => ({
  scheduleSessionTimer: vi.fn(),
  cancelSessionTimer: (...args: unknown[]) => mockCancelSessionTimer(...args),
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

vi.mock('../../src/services/song-pool.js', () => ({
  markSongSung: vi.fn(),
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
const mockFlushEventStream = vi.fn();
vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
  flushEventStream: (...args: unknown[]) => mockFlushEventStream(...args),
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

// Mock the lounge-api to prevent real HTTP calls
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

import {
  pairTv,
  unpairTv,
  isTvPaired,
  getTvConnection,
  setTvFactory,
  resetAllTvConnections,
  handleQuickPickSongSelected,
  handleSpinWheelSongSelected,
  endSession,
} from '../../src/services/session-manager.js';

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

describe('session-manager TV integration', () => {
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

  describe('pairTv', () => {
    it('creates TV connection and stores in map', async () => {
      await pairTv('session-1', 'ABC123');

      expect(mockTv.connect).toHaveBeenCalledWith('ABC123');
      expect(mockTv.onNowPlaying).toHaveBeenCalled();
      expect(mockTv.onStatusChange).toHaveBeenCalled();
      expect(isTvPaired('session-1')).toBe(true);
      expect(getTvConnection('session-1')).toBe(mockTv);
    });

    it('registers nowPlaying callback that emits TV_NOW_PLAYING immediately', async () => {
      mockDetectSong.mockResolvedValue(null);
      await pairTv('session-1', 'ABC123');

      // Get the registered callback
      const onNowPlayingCall = (mockTv.onNowPlaying as ReturnType<typeof vi.fn>).mock.calls[0]!;
      const callback = onNowPlayingCall[0] as (event: NowPlayingEvent) => void;

      // Simulate a nowPlaying event
      callback({ videoId: 'vid123', title: 'Test Song', state: 'playing' });

      expect(mockTo).toHaveBeenCalledWith('session-1');
      expect(mockEmit).toHaveBeenCalledWith('tv:nowPlaying', {
        videoId: 'vid123',
        title: 'Test Song',
        state: 'playing',
      });
      // song:detected is emitted asynchronously via detectSong — tested in session-manager-detection.test.ts
      expect(mockDetectSong).toHaveBeenCalledWith('vid123');
    });

    it('registers statusChange callback that removes on disconnect', async () => {
      await pairTv('session-1', 'ABC123');

      const onStatusCall = (mockTv.onStatusChange as ReturnType<typeof vi.fn>).mock.calls[0]!;
      const callback = onStatusCall[0] as (status: TvConnectionStatus) => void;

      // Simulate disconnected status (after reconnect failure)
      callback('disconnected');

      // Should have been removed from map
      expect(getTvConnection('session-1')).toBeUndefined();
    });
  });

  describe('unpairTv', () => {
    it('disconnects and removes from map', async () => {
      await pairTv('session-1', 'ABC123');
      await unpairTv('session-1');

      expect(mockTv.disconnect).toHaveBeenCalled();
      expect(getTvConnection('session-1')).toBeUndefined();
      expect(isTvPaired('session-1')).toBe(false);
    });

    it('handles unpair when no connection exists', async () => {
      // Should not throw
      await unpairTv('nonexistent');
    });
  });

  describe('isTvPaired', () => {
    it('returns false when no connection', () => {
      expect(isTvPaired('session-1')).toBe(false);
    });

    it('returns true when connected', async () => {
      await pairTv('session-1', 'ABC123');
      expect(isTvPaired('session-1')).toBe(true);
    });
  });

  describe('auto-queue on song selection', () => {
    it('calls addToQueue on Quick Pick song selection when TV paired', async () => {
      await pairTv('session-1', 'ABC123');

      const context = createTestDJContext({ state: DJState.songSelection });
      mockGetSessionDjState.mockReturnValue(context);
      mockProcessTransition.mockReturnValue({
        newContext: { ...context, state: DJState.song },
        sideEffects: [],
      });

      await handleQuickPickSongSelected('session-1', {
        catalogTrackId: 'cat-1',
        songTitle: 'Test Song',
        artist: 'Test Artist',
        youtubeVideoId: 'yt-vid-123',
        overlapCount: 2,
      });

      expect(mockTv.addToQueue).toHaveBeenCalledWith('yt-vid-123');
    });

    it('calls addToQueue on Spin Wheel song selection when TV paired', async () => {
      await pairTv('session-1', 'ABC123');

      const context = createTestDJContext({ state: DJState.songSelection });
      mockGetSessionDjState.mockReturnValue(context);
      mockProcessTransition.mockReturnValue({
        newContext: { ...context, state: DJState.song },
        sideEffects: [],
      });

      await handleSpinWheelSongSelected('session-1', {
        catalogTrackId: 'cat-1',
        songTitle: 'Test Song',
        artist: 'Test Artist',
        youtubeVideoId: 'yt-vid-456',
        overlapCount: 2,
        segmentIndex: 0,
      });

      expect(mockTv.addToQueue).toHaveBeenCalledWith('yt-vid-456');
    });

    it('does not call addToQueue when TV not paired', async () => {
      const context = createTestDJContext({ state: DJState.songSelection });
      mockGetSessionDjState.mockReturnValue(context);
      mockProcessTransition.mockReturnValue({
        newContext: { ...context, state: DJState.song },
        sideEffects: [],
      });

      await handleQuickPickSongSelected('session-1', {
        catalogTrackId: 'cat-1',
        songTitle: 'Test Song',
        artist: 'Test Artist',
        youtubeVideoId: 'yt-vid-123',
        overlapCount: 2,
      });

      // No TV paired — addToQueue should not be called
      expect(mockTv.addToQueue).not.toHaveBeenCalled();
    });
  });

  describe('pairTv re-pair', () => {
    it('disconnects existing connection before creating new one', async () => {
      const firstTv = createMockTvIntegration();
      const secondTv = createMockTvIntegration();
      let callCount = 0;
      setTvFactory(() => {
        callCount++;
        return callCount === 1 ? firstTv : secondTv;
      });

      await pairTv('session-1', 'ABC123');
      expect(firstTv.connect).toHaveBeenCalledWith('ABC123');

      await pairTv('session-1', 'DEF456');
      expect(firstTv.disconnect).toHaveBeenCalled();
      expect(secondTv.connect).toHaveBeenCalledWith('DEF456');
      expect(getTvConnection('session-1')).toBe(secondTv);
    });
  });

  describe('TV disconnect graceful degradation', () => {
    it('emits TV_STATUS with degraded flag on disconnect', async () => {
      await pairTv('session-1', 'ABC123');

      const onStatusCall = (mockTv.onStatusChange as ReturnType<typeof vi.fn>).mock.calls[0]!;
      const callback = onStatusCall[0] as (status: TvConnectionStatus) => void;

      callback('disconnected');

      expect(mockTo).toHaveBeenCalledWith('session-1');
      expect(mockEmit).toHaveBeenCalledWith('tv:status', {
        status: 'disconnected',
        degraded: true,
        message: 'TV disconnected. Continuing in suggestion-only mode.',
      });
    });

    it('cleans up tvConnections entry on disconnect', async () => {
      await pairTv('session-1', 'ABC123');
      expect(getTvConnection('session-1')).toBeDefined();

      const onStatusCall = (mockTv.onStatusChange as ReturnType<typeof vi.fn>).mock.calls[0]!;
      const callback = onStatusCall[0] as (status: TvConnectionStatus) => void;

      callback('disconnected');

      expect(getTvConnection('session-1')).toBeUndefined();
      expect(isTvPaired('session-1')).toBe(false);
    });

    it('emits normal TV_STATUS for non-disconnect statuses', async () => {
      await pairTv('session-1', 'ABC123');

      const onStatusCall = (mockTv.onStatusChange as ReturnType<typeof vi.fn>).mock.calls[0]!;
      const callback = onStatusCall[0] as (status: TvConnectionStatus) => void;

      callback('reconnecting');

      expect(mockEmit).toHaveBeenCalledWith('tv:status', { status: 'reconnecting' });
    });
  });

  describe('endSession cleanup', () => {
    it('disconnects TV on session end', async () => {
      await pairTv('session-1', 'ABC123');
      expect(isTvPaired('session-1')).toBe(true);

      // endSession requires a valid session in DB and DJ state
      mockFindById.mockResolvedValueOnce({ host_user_id: 'host-1' });
      mockGetSessionDjState.mockReturnValueOnce(
        createTestDJContext({ state: DJState.song }),
      );
      mockProcessTransition.mockReturnValueOnce({
        newContext: createTestDJContext({ state: DJState.finale }),
        sideEffects: [],
      });
      mockFlushEventStream.mockReturnValueOnce([]);
      mockUpdateStatus.mockResolvedValueOnce(undefined);

      await endSession('session-1', 'host-1');

      expect(mockTv.disconnect).toHaveBeenCalled();
      expect(getTvConnection('session-1')).toBeUndefined();
    });
  });
});
