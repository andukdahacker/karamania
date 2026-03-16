import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDJContext } from '../factories/dj-state.js';
import { DJState } from '../../src/dj-engine/types.js';
import type { QuickPickSong } from '../../src/services/quick-pick.js';

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

vi.mock('../../src/db/connection.js', () => ({
  db: {},
}));

vi.mock('../../src/services/party-code.js', () => ({
  generateUniquePartyCode: vi.fn(),
}));

const mockFindById = vi.fn();
const mockUpdateDjState = vi.fn();
const mockUpdateStatus = vi.fn();
const mockWriteEventStream = vi.fn();
vi.mock('../../src/persistence/session-repository.js', () => ({
  create: vi.fn(),
  addParticipant: vi.fn(),
  addParticipantIfNotExists: vi.fn(),
  getParticipants: vi.fn(),
  findById: mockFindById,
  updateStatus: mockUpdateStatus,
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

const mockScheduleSessionTimer = vi.fn();
const mockCancelSessionTimer = vi.fn();
const mockResumeSessionTimer = vi.fn();
vi.mock('../../src/services/timer-scheduler.js', () => ({
  scheduleSessionTimer: (...args: unknown[]) => mockScheduleSessionTimer(...args),
  cancelSessionTimer: (...args: unknown[]) => mockCancelSessionTimer(...args),
  pauseSessionTimer: vi.fn(),
  resumeSessionTimer: (...args: unknown[]) => mockResumeSessionTimer(...args),
}));

const mockBroadcastDjState = vi.fn();
const mockBroadcastQuickPickStarted = vi.fn();
const mockGetIO = vi.fn();
vi.mock('../../src/services/dj-broadcaster.js', () => ({
  broadcastDjState: (...args: unknown[]) => mockBroadcastDjState(...args),
  broadcastDjPause: vi.fn(),
  broadcastDjResume: vi.fn(),
  broadcastCeremonyAnticipation: vi.fn(),
  broadcastCeremonyReveal: vi.fn(),
  broadcastCeremonyQuick: vi.fn(),
  broadcastCardDealt: vi.fn(),
  broadcastQuickPickStarted: (...args: unknown[]) => mockBroadcastQuickPickStarted(...args),
  getIO: (...args: unknown[]) => mockGetIO(...args),
}));

const mockStartRound = vi.fn();
const mockGetRound = vi.fn();
const mockResolveByTimeout = vi.fn();
const mockClearRound = vi.fn();
vi.mock('../../src/services/quick-pick.js', () => ({
  startRound: (...args: unknown[]) => mockStartRound(...args),
  getRound: (...args: unknown[]) => mockGetRound(...args),
  resolveByTimeout: (...args: unknown[]) => mockResolveByTimeout(...args),
  clearRound: (...args: unknown[]) => mockClearRound(...args),
  resetAllRounds: vi.fn(),
}));

const mockComputeSuggestions = vi.fn();
vi.mock('../../src/services/suggestion-engine.js', () => ({
  computeSuggestions: (...args: unknown[]) => mockComputeSuggestions(...args),
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
const mockFlushEventStream = vi.fn();
vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
  flushEventStream: (...args: unknown[]) => mockFlushEventStream(...args),
  getEventStream: vi.fn().mockReturnValue([]),
}));

vi.mock('../../src/services/activity-tracker.js', () => ({
  removeSession: vi.fn(),
}));

vi.mock('../../src/services/streak-tracker.js', () => ({
  clearSessionStreaks: vi.fn(),
  clearUserStreak: vi.fn(),
  clearStreakStore: vi.fn(),
}));

vi.mock('../../src/services/card-dealer.js', () => ({
  dealCard: vi.fn().mockReturnValue({ id: 'card-1', title: 'Test', description: 'Test', type: 'vocal', emoji: '🎤' }),
  clearDealtCards: vi.fn(),
}));

vi.mock('../../src/services/participation-scoring.js', () => ({
  calculateScoreIncrement: vi.fn().mockReturnValue(0),
  ACTION_TIER_MAP: {} as Record<string, string>,
}));

vi.mock('../../src/services/award-generator.js', () => ({
  generateAward: vi.fn(),
  AWARD_TEMPLATES: [],
  AwardTone: { comedic: 'comedic' },
}));

const testSongs: QuickPickSong[] = [
  { catalogTrackId: 'song-1', songTitle: 'Song 1', artist: 'Artist 1', youtubeVideoId: 'yt_1', overlapCount: 3 },
  { catalogTrackId: 'song-2', songTitle: 'Song 2', artist: 'Artist 2', youtubeVideoId: 'yt_2', overlapCount: 2 },
  { catalogTrackId: 'song-3', songTitle: 'Song 3', artist: 'Artist 3', youtubeVideoId: 'yt_3', overlapCount: 1 },
  { catalogTrackId: 'song-4', songTitle: 'Song 4', artist: 'Artist 4', youtubeVideoId: 'yt_4', overlapCount: 0 },
  { catalogTrackId: 'song-5', songTitle: 'Song 5', artist: 'Artist 5', youtubeVideoId: 'yt_5', overlapCount: 0 },
];

describe('session-manager Quick Pick integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateDjState.mockResolvedValue(undefined);
  });

  describe('Quick Pick initialization on songSelection', () => {
    it('initializes round when DJ enters songSelection', async () => {
      const preContext = createTestDJContext({ sessionId: 'session-1', participantCount: 5 });
      const songSelContext = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const, participantCount: 5 });

      mockProcessTransition.mockReturnValue({
        newContext: songSelContext,
        sideEffects: [
          { type: 'broadcast', data: {} },
          { type: 'persist', data: { context: songSelContext } },
          { type: 'scheduleTimer', data: { durationMs: 15000 } },
        ],
      });
      mockComputeSuggestions.mockResolvedValue(testSongs);

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', preContext, { type: 'SESSION_STARTED' });

      // Wait for fire-and-forget initializeQuickPick
      await vi.waitFor(() => {
        expect(mockComputeSuggestions).toHaveBeenCalledWith('session-1', 5);
      });
    });

    it('fetches 5 suggestions and starts round', async () => {
      const preContext = createTestDJContext({ sessionId: 'session-1', participantCount: 5 });
      const songSelContext = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const, participantCount: 5 });

      mockProcessTransition.mockReturnValue({
        newContext: songSelContext,
        sideEffects: [
          { type: 'broadcast', data: {} },
          { type: 'persist', data: { context: songSelContext } },
          { type: 'scheduleTimer', data: { durationMs: 15000 } },
        ],
      });
      mockComputeSuggestions.mockResolvedValue(testSongs);

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', preContext, { type: 'SESSION_STARTED' });

      await vi.waitFor(() => {
        expect(mockStartRound).toHaveBeenCalledWith(
          'session-1',
          expect.arrayContaining([expect.objectContaining({ catalogTrackId: 'song-1' })]),
          5,
        );
      });
    });

    it('broadcasts quickpick:started with songs and timer', async () => {
      const preContext = createTestDJContext({ sessionId: 'session-1', participantCount: 5 });
      const songSelContext = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const, participantCount: 5 });

      mockProcessTransition.mockReturnValue({
        newContext: songSelContext,
        sideEffects: [
          { type: 'broadcast', data: {} },
          { type: 'persist', data: { context: songSelContext } },
          { type: 'scheduleTimer', data: { durationMs: 15000 } },
        ],
      });
      mockComputeSuggestions.mockResolvedValue(testSongs);

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', preContext, { type: 'SESSION_STARTED' });

      await vi.waitFor(() => {
        expect(mockBroadcastQuickPickStarted).toHaveBeenCalledWith('session-1', {
          songs: expect.arrayContaining([expect.objectContaining({ catalogTrackId: 'song-1' })]),
          participantCount: 5,
          timerDurationMs: 15_000,
        });
      });
    });

    it('schedules 15s timer via DJ engine side effect', async () => {
      const preContext = createTestDJContext({ sessionId: 'session-1', participantCount: 5 });
      const songSelContext = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const, participantCount: 5 });

      mockProcessTransition.mockReturnValue({
        newContext: songSelContext,
        sideEffects: [
          { type: 'scheduleTimer', data: { durationMs: 15000 } },
          { type: 'broadcast', data: {} },
          { type: 'persist', data: { context: songSelContext } },
        ],
      });
      mockComputeSuggestions.mockResolvedValue(testSongs);

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', preContext, { type: 'SESSION_STARTED' });

      expect(mockScheduleSessionTimer).toHaveBeenCalledWith('session-1', 15000, expect.any(Function));
    });
  });

  describe('Timer resolution triggers Quick Pick', () => {
    it('resolves Quick Pick on songSelection timeout', async () => {
      const songSelContext = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const, participantCount: 5 });
      mockGetSessionDjState.mockReturnValue(songSelContext);
      mockGetRound.mockReturnValue({ resolved: false, songs: testSongs });

      const winnerSong = testSongs[0]!;
      mockResolveByTimeout.mockReturnValue(winnerSong);

      // Mock the song selected flow
      const mockEmit = vi.fn();
      mockGetIO.mockReturnValue({ to: () => ({ emit: mockEmit }) });

      // processDjTransition for SONG_SELECTED
      const nextContext = createTestDJContext({ sessionId: 'session-1', state: 'partyCardDeal' as const });
      mockProcessTransition.mockReturnValue({
        newContext: nextContext,
        sideEffects: [{ type: 'broadcast', data: {} }, { type: 'persist', data: { context: nextContext } }],
      });
      mockUpdateDjState.mockResolvedValue(undefined);

      // Simulate the timer callback by capturing it from scheduleSessionTimer
      const preContext = createTestDJContext({ sessionId: 'session-1', participantCount: 5 });
      const songSelResult = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const, participantCount: 5 });
      mockProcessTransition.mockReturnValueOnce({
        newContext: songSelResult,
        sideEffects: [{ type: 'scheduleTimer', data: { durationMs: 15000 } }],
      });
      mockComputeSuggestions.mockResolvedValue([]);

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', preContext, { type: 'SESSION_STARTED' });

      // Extract the timer callback
      const timerCallback = mockScheduleSessionTimer.mock.calls[0]?.[2] as () => void;
      expect(timerCallback).toBeDefined();

      // Reset mocks for the timer fire
      mockProcessTransition.mockReturnValue({
        newContext: nextContext,
        sideEffects: [{ type: 'broadcast', data: {} }, { type: 'persist', data: { context: nextContext } }],
      });

      // Fire the timer
      await timerCallback();

      expect(mockResolveByTimeout).toHaveBeenCalledWith('session-1');
      expect(mockMarkSongSung).toHaveBeenCalledWith('session-1', winnerSong.songTitle, winnerSong.artist);
      expect(mockClearRound).toHaveBeenCalledWith('session-1');
    });
  });

  describe('handleQuickPickSongSelected', () => {
    it('emits song:queued BEFORE DJ transition', async () => {
      const songSelContext = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      mockGetSessionDjState.mockReturnValue(songSelContext);

      const callOrder: string[] = [];
      const mockEmit = vi.fn().mockImplementation(() => { callOrder.push('emit'); });
      mockGetIO.mockReturnValue({ to: () => ({ emit: mockEmit }) });
      mockProcessTransition.mockImplementation(() => {
        callOrder.push('transition');
        return {
          newContext: createTestDJContext({ state: 'partyCardDeal' as const }),
          sideEffects: [],
        };
      });

      const { handleQuickPickSongSelected } = await import('../../src/services/session-manager.js');
      await handleQuickPickSongSelected('session-1', testSongs[0]!);

      expect(callOrder[0]).toBe('emit');
      expect(callOrder[1]).toBe('transition');
    });

    it('cancels session timer on early majority', async () => {
      const songSelContext = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      mockGetSessionDjState.mockReturnValue(songSelContext);
      mockGetIO.mockReturnValue({ to: () => ({ emit: vi.fn() }) });
      mockProcessTransition.mockReturnValue({
        newContext: createTestDJContext({ state: 'partyCardDeal' as const }),
        sideEffects: [],
      });

      const { handleQuickPickSongSelected } = await import('../../src/services/session-manager.js');
      await handleQuickPickSongSelected('session-1', testSongs[0]!);

      expect(mockCancelSessionTimer).toHaveBeenCalledWith('session-1');
    });
  });

  describe('clearRound in endSession', () => {
    it('calls clearRound during session cleanup', async () => {
      const context = createTestDJContext({ sessionId: 'session-1' });
      mockGetSessionDjState.mockReturnValue(context);
      mockFindById.mockResolvedValue({ id: 'session-1', host_user_id: 'host-1', status: 'active' });
      mockUpdateStatus.mockResolvedValue(undefined);
      mockFlushEventStream.mockReturnValue([]);
      mockProcessTransition.mockReturnValue({
        newContext: createTestDJContext({ state: 'finale' as const }),
        sideEffects: [],
      });

      const { endSession } = await import('../../src/services/session-manager.js');
      await endSession('session-1', 'host-1');

      expect(mockClearRound).toHaveBeenCalledWith('session-1');
    });
  });
});
