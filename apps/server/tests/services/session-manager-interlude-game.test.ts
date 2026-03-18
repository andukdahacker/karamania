import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestDJContext } from '../factories/dj-state.js';
import { DJState } from '../../src/dj-engine/types.js';

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

const mockUpdateDjState = vi.fn();
const mockWriteEventStream = vi.fn();
const mockFindById = vi.fn();
vi.mock('../../src/persistence/session-repository.js', () => ({
  create: vi.fn(),
  addParticipant: vi.fn(),
  addParticipantIfNotExists: vi.fn(),
  getParticipants: vi.fn(),
  findById: (...args: unknown[]) => mockFindById(...args),
  updateStatus: vi.fn(),
  updateHost: vi.fn(),
  updateDjState: mockUpdateDjState,
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
  processTransition: mockProcessTransition,
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

vi.mock('../../src/services/timer-scheduler.js', () => ({
  scheduleSessionTimer: vi.fn(),
  cancelSessionTimer: vi.fn(),
  pauseSessionTimer: vi.fn(),
  resumeSessionTimer: vi.fn(),
}));

const mockBroadcastInterludeGameStarted = vi.fn();
const mockBroadcastInterludeGameEnded = vi.fn();
vi.mock('../../src/services/dj-broadcaster.js', () => ({
  broadcastDjState: vi.fn(),
  broadcastDjPause: vi.fn(),
  broadcastDjResume: vi.fn(),
  broadcastCeremonyAnticipation: vi.fn(),
  broadcastCeremonyReveal: vi.fn(),
  broadcastCeremonyQuick: vi.fn(),
  broadcastInterludeVoteStarted: vi.fn(),
  broadcastInterludeVoteResult: vi.fn(),
  broadcastInterludeGameStarted: (...args: unknown[]) => mockBroadcastInterludeGameStarted(...args),
  broadcastInterludeGameEnded: (...args: unknown[]) => mockBroadcastInterludeGameEnded(...args),
  broadcastCardDealt: vi.fn(),
  broadcastQuickPickStarted: vi.fn(),
  broadcastSpinWheelStarted: vi.fn(),
  broadcastSpinWheelResult: vi.fn(),
  broadcastModeChanged: vi.fn(),
  broadcastQuickVoteResult: vi.fn(),
  getIO: vi.fn(),
}));

const mockDealKingsCupCard = vi.fn();
const mockClearKingsCupSession = vi.fn();
vi.mock('../../src/services/kings-cup-dealer.js', () => ({
  dealCard: (...args: unknown[]) => mockDealKingsCupCard(...args),
  clearSession: (...args: unknown[]) => mockClearKingsCupSession(...args),
  resetAll: vi.fn(),
}));

vi.mock('../../src/services/dare-pull-dealer.js', () => ({
  dealDare: vi.fn().mockReturnValue({ id: 'mock-dare', title: 'Mock Dare', dare: 'Mock dare text', emoji: '🎯' }),
  selectTarget: vi.fn().mockReturnValue(null),
  clearSession: vi.fn(),
  resetAll: vi.fn(),
}));

vi.mock('../../src/services/quick-vote-dealer.js', () => ({
  dealQuestion: vi.fn().mockReturnValue({ id: 'mock-q', question: 'Mock?', optionA: 'YES', optionB: 'NO', emoji: '⚡' }),
  startQuickVoteRound: vi.fn(),
  recordQuickVote: vi.fn().mockReturnValue({ recorded: true, firstVote: true }),
  resolveQuickVote: vi.fn().mockReturnValue({ optionACounts: 3, optionBCounts: 2, totalVotes: 5 }),
  clearSession: vi.fn(),
  resetAll: vi.fn(),
}));

vi.mock('../../src/services/activity-voter.js', () => ({
  selectActivityOptions: vi.fn().mockReturnValue([{ id: 'kings_cup', name: 'Kings Cup', description: '', icon: '👑', universal: true, minParticipants: 3 }]),
  startVoteRound: vi.fn(),
  resolveByTimeout: vi.fn(),
  getVoteCounts: vi.fn().mockReturnValue({ kings_cup: 3 }),
  clearSession: vi.fn(),
  resetAllRounds: vi.fn(),
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
const mockGetEventStream = vi.fn();
vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
  flushEventStream: vi.fn().mockReturnValue([]),
  getEventStream: (...args: unknown[]) => mockGetEventStream(...args),
  removeEventStream: vi.fn(),
}));

vi.mock('../../src/services/activity-tracker.js', () => ({
  removeSession: vi.fn(),
}));

vi.mock('../../src/services/participation-scoring.js', () => ({
  calculateScoreIncrement: vi.fn(),
  ACTION_TIER_MAP: {},
}));

vi.mock('../../src/services/award-generator.js', () => ({
  generateAward: vi.fn().mockReturnValue({ award: 'Star', tone: 'hype' }),
  AWARD_TEMPLATES: [],
  AwardTone: { hype: 'hype' },
}));

vi.mock('../../src/services/streak-tracker.js', () => ({
  clearSessionStreaks: vi.fn(),
}));

vi.mock('../../src/services/peak-detector.js', () => ({
  clearSession: vi.fn(),
}));

vi.mock('../../src/services/card-dealer.js', () => ({
  dealCard: vi.fn(),
  clearDealtCards: vi.fn(),
}));

vi.mock('../../src/services/song-pool.js', () => ({
  clearPool: vi.fn(),
  markSongSung: vi.fn(),
}));

vi.mock('../../src/services/song-detection.js', () => ({
  detectSong: vi.fn(),
}));

vi.mock('../../src/services/quick-pick.js', () => ({
  startRound: vi.fn(),
  getRound: vi.fn(),
  resolveByTimeout: vi.fn(),
  clearRound: vi.fn(),
}));

vi.mock('../../src/services/suggestion-engine.js', () => ({
  computeSuggestions: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../src/services/capture-trigger.js', () => ({
  shouldEmitCaptureBubble: vi.fn().mockReturnValue(false),
  markBubbleEmitted: vi.fn(),
  clearCaptureTriggerState: vi.fn(),
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
}));

vi.mock('../../src/integrations/lounge-api.js', () => ({
  createLoungeApiClient: vi.fn(),
}));

describe('session-manager interlude game dispatch', () => {
  const mockCard = { id: 'group-toast', title: 'Group Toast!', rule: 'Everyone cheers!', emoji: '🥂' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetEventStream.mockReturnValue([]);
    mockDealKingsCupCard.mockReturnValue(mockCard);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('finalizeInterludeVote → startInterludeGame', () => {
    it('dispatches to executeKingsCup when selectedActivity is kings_cup', async () => {
      // Setup: context in interlude state with selectedActivity about to be set
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'kings_cup' },
      });

      // Mock getSessionDjState to return context with selectedActivity after reveal timer
      mockGetSessionDjState.mockReturnValue(interludeContext);

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'kings_cup',
        name: 'Kings Cup',
        description: '',
        icon: '👑',
        universal: true,
        minParticipants: 3,
      });

      // Advance past reveal delay (5s)
      vi.advanceTimersByTime(5_000);

      // Should have called dealCard and broadcast gameStarted
      expect(mockDealKingsCupCard).toHaveBeenCalledWith('session-1');
      expect(mockBroadcastInterludeGameStarted).toHaveBeenCalledWith('session-1', {
        activityId: 'kings_cup',
        card: mockCard,
        gameDurationMs: 10_000,
      });
    });

    it('triggers INTERLUDE_DONE when selectedActivity has no handler', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'unknown_game' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);
      mockProcessTransition.mockReturnValue({
        newContext: createTestDJContext({ sessionId: 'session-1', state: DJState.songSelection }),
        sideEffects: [],
      });

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'unknown_game',
        name: 'Unknown',
        description: '',
        icon: '',
        universal: true,
        minParticipants: 2,
      });

      // Advance past reveal delay (5s)
      vi.advanceTimersByTime(5_000);

      // Should NOT have called dealCard
      expect(mockDealKingsCupCard).not.toHaveBeenCalled();

      // Should have triggered INTERLUDE_DONE transition
      expect(mockProcessTransition).toHaveBeenCalledWith(
        interludeContext,
        expect.objectContaining({ type: 'INTERLUDE_DONE' }),
        expect.any(Number),
      );
    });

    it('appends interlude:gameStarted event to event stream', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'kings_cup' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'kings_cup',
        name: 'Kings Cup',
        description: '',
        icon: '👑',
        universal: true,
        minParticipants: 3,
      });

      vi.advanceTimersByTime(5_000);

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'interlude:gameStarted',
        data: { activityId: 'kings_cup', cardId: 'group-toast' },
      }));
    });
  });

  describe('game timer behavior', () => {
    it('broadcasts interlude:gameEnded after 10s game timer', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'kings_cup' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);
      mockProcessTransition.mockReturnValue({
        newContext: createTestDJContext({ sessionId: 'session-1', state: DJState.songSelection }),
        sideEffects: [],
      });

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'kings_cup',
        name: 'Kings Cup',
        description: '',
        icon: '👑',
        universal: true,
        minParticipants: 3,
      });

      // Advance past reveal delay (5s) — starts game
      vi.advanceTimersByTime(5_000);
      expect(mockBroadcastInterludeGameEnded).not.toHaveBeenCalled();

      // Advance game timer (10s)
      vi.advanceTimersByTime(10_000);

      expect(mockBroadcastInterludeGameEnded).toHaveBeenCalledWith('session-1', {
        activityId: 'kings_cup',
      });
    });

    it('triggers INTERLUDE_DONE after game ends', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'kings_cup' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);
      mockProcessTransition.mockReturnValue({
        newContext: createTestDJContext({ sessionId: 'session-1', state: DJState.songSelection }),
        sideEffects: [],
      });

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'kings_cup',
        name: 'Kings Cup',
        description: '',
        icon: '👑',
        universal: true,
        minParticipants: 3,
      });

      // Advance past reveal (5s) + game (10s)
      vi.advanceTimersByTime(15_000);

      expect(mockProcessTransition).toHaveBeenCalledWith(
        interludeContext,
        expect.objectContaining({ type: 'INTERLUDE_DONE' }),
        expect.any(Number),
      );
    });

    it('appends interlude:gameEnded event to event stream', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'kings_cup' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);
      mockProcessTransition.mockReturnValue({
        newContext: createTestDJContext({ sessionId: 'session-1', state: DJState.songSelection }),
        sideEffects: [],
      });

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'kings_cup',
        name: 'Kings Cup',
        description: '',
        icon: '👑',
        universal: true,
        minParticipants: 3,
      });

      vi.advanceTimersByTime(15_000);

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'interlude:gameEnded',
        data: { activityId: 'kings_cup' },
      }));
    });

    it('does not fire game end if session is no longer in interlude state', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'kings_cup' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'kings_cup',
        name: 'Kings Cup',
        description: '',
        icon: '👑',
        universal: true,
        minParticipants: 3,
      });

      // Advance past reveal delay
      vi.advanceTimersByTime(5_000);
      mockBroadcastInterludeGameStarted.mockClear();

      // Now simulate state changed (e.g., HOST_SKIP)
      mockGetSessionDjState.mockReturnValue(
        createTestDJContext({ sessionId: 'session-1', state: DJState.songSelection }),
      );

      // Advance game timer
      vi.advanceTimersByTime(10_000);

      // Should NOT broadcast game ended or trigger transition
      expect(mockBroadcastInterludeGameEnded).not.toHaveBeenCalled();
    });
  });

  describe('HOST_SKIP during game', () => {
    it('cancels game timer and prevents gameEnded broadcast on HOST_SKIP', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'kings_cup' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);

      const { handleInterludeVoteWinner, processDjTransition } = await import('../../src/services/session-manager.js');

      // Start the interlude game flow
      handleInterludeVoteWinner('session-1', {
        id: 'kings_cup',
        name: 'Kings Cup',
        description: '',
        icon: '👑',
        universal: true,
        minParticipants: 3,
      });

      // Advance past reveal delay (5s) — game starts
      vi.advanceTimersByTime(5_000);
      expect(mockBroadcastInterludeGameStarted).toHaveBeenCalled();
      mockBroadcastInterludeGameEnded.mockClear();
      mockProcessTransition.mockClear();

      // HOST_SKIP during game — processDjTransition clears interlude timers when context.state === interlude
      const songSelectionContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.songSelection,
      });
      mockProcessTransition.mockReturnValue({
        newContext: songSelectionContext,
        sideEffects: [],
      });

      await processDjTransition('session-1', interludeContext, { type: 'HOST_SKIP' });

      // Advance past game timer (10s) — should NOT fire because clearInterludeTimers was called
      vi.advanceTimersByTime(10_000);
      expect(mockBroadcastInterludeGameEnded).not.toHaveBeenCalled();
    });
  });

  describe('session cleanup', () => {
    it('clears kings cup session data on session end', async () => {
      const lobbyContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.lobby,
        songCount: 3,
      });
      const finaleContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.finale,
      });

      mockFindById.mockResolvedValue({ id: 'session-1', host_user_id: 'host-1' });
      mockGetSessionDjState.mockReturnValue(lobbyContext);
      mockProcessTransition.mockReturnValue({ newContext: finaleContext, sideEffects: [] });
      mockGetEventStream.mockReturnValue([]);

      const { endSession } = await import('../../src/services/session-manager.js');
      await endSession('session-1', 'host-1');

      expect(mockClearKingsCupSession).toHaveBeenCalledWith('session-1');
    });
  });
});
