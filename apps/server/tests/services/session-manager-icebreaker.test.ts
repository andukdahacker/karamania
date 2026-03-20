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

const mockScheduleSessionTimer = vi.fn();
vi.mock('../../src/services/timer-scheduler.js', () => ({
  scheduleSessionTimer: (...args: unknown[]) => mockScheduleSessionTimer(...args),
  cancelSessionTimer: vi.fn(),
  pauseSessionTimer: vi.fn(),
  resumeSessionTimer: vi.fn(),
}));

const mockBroadcastIcebreakerStarted = vi.fn();
const mockBroadcastIcebreakerResult = vi.fn();
vi.mock('../../src/services/dj-broadcaster.js', () => ({
  broadcastDjState: vi.fn(),
  broadcastDjPause: vi.fn(),
  broadcastDjResume: vi.fn(),
  broadcastCeremonyAnticipation: vi.fn(),
  broadcastCeremonyReveal: vi.fn(),
  broadcastCeremonyQuick: vi.fn(),
  broadcastInterludeVoteStarted: vi.fn(),
  broadcastInterludeVoteResult: vi.fn(),
  broadcastInterludeGameStarted: vi.fn(),
  broadcastInterludeGameEnded: vi.fn(),
  broadcastQuickVoteResult: vi.fn(),
  broadcastCardDealt: vi.fn(),
  broadcastQuickPickStarted: vi.fn(),
  broadcastSpinWheelStarted: vi.fn(),
  broadcastSpinWheelResult: vi.fn(),
  broadcastModeChanged: vi.fn(),
  broadcastIcebreakerStarted: (...args: unknown[]) => mockBroadcastIcebreakerStarted(...args),
  broadcastIcebreakerResult: (...args: unknown[]) => mockBroadcastIcebreakerResult(...args),
  broadcastFinaleAwards: vi.fn(),
  broadcastFinaleStats: vi.fn(),
  broadcastFinaleSetlist: vi.fn(),
  getIO: vi.fn(),
}));

vi.mock('../../src/socket-handlers/connection-handler.js', () => ({
  clearSessionTimers: vi.fn(),
}));

vi.mock('../../src/services/kings-cup-dealer.js', () => ({
  dealCard: vi.fn().mockReturnValue({ id: 'mock-card', title: 'Mock', rule: 'Mock rule', emoji: '🃏' }),
  clearSession: vi.fn(),
  resetAll: vi.fn(),
}));

vi.mock('../../src/services/dare-pull-dealer.js', () => ({
  dealDare: vi.fn().mockReturnValue({ id: 'mock-dare', title: 'Mock Dare', dare: 'Mock dare text', emoji: '🎯' }),
  selectTarget: vi.fn().mockReturnValue(null),
  clearSession: vi.fn(),
  resetAll: vi.fn(),
}));

vi.mock('../../src/services/quick-vote-dealer.js', () => ({
  dealQuestion: vi.fn().mockReturnValue({ id: 'mock-q', question: 'Mock?', optionA: 'A', optionB: 'B', emoji: '❓' }),
  startQuickVoteRound: vi.fn(),
  recordQuickVote: vi.fn().mockReturnValue({ recorded: true, firstVote: true }),
  resolveQuickVote: vi.fn(),
  clearSession: vi.fn(),
  resetAll: vi.fn(),
}));

vi.mock('../../src/services/singalong-dealer.js', () => ({
  dealPrompt: vi.fn().mockReturnValue({ id: 'mock-prompt', title: 'Mock', lyric: 'Mock lyric', emoji: '🎤' }),
  clearSession: vi.fn(),
  resetAll: vi.fn(),
}));

const mockDealIcebreakerQuestion = vi.fn();
const mockStartIcebreakerRound = vi.fn();
const mockResolveIcebreaker = vi.fn();
const mockClearIcebreakerSession = vi.fn();
vi.mock('../../src/services/icebreaker-dealer.js', () => ({
  dealQuestion: (...args: unknown[]) => mockDealIcebreakerQuestion(...args),
  startIcebreakerRound: (...args: unknown[]) => mockStartIcebreakerRound(...args),
  resolveIcebreaker: (...args: unknown[]) => mockResolveIcebreaker(...args),
  clearSession: (...args: unknown[]) => mockClearIcebreakerSession(...args),
  resetAll: vi.fn(),
}));

vi.mock('../../src/services/activity-voter.js', () => ({
  selectActivityOptions: vi.fn().mockReturnValue([]),
  startVoteRound: vi.fn(),
  resolveByTimeout: vi.fn(),
  getVoteCounts: vi.fn().mockReturnValue({}),
  clearSession: vi.fn(),
  resetAllRounds: vi.fn(),
}));

const mockGetActiveConnections = vi.fn();
vi.mock('../../src/services/connection-tracker.js', () => ({
  removeSession: vi.fn(),
  getActiveConnections: (...args: unknown[]) => mockGetActiveConnections(...args),
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

vi.mock('../../src/services/finale-award-generator.js', () => ({
  analyzeSessionForAwards: vi.fn().mockReturnValue([]),
  generateFinaleAwards: vi.fn().mockReturnValue([]),
  FinaleAwardCategory: {
    performer: 'performer',
    hypeLeader: 'hypeLeader',
    socialButterfly: 'socialButterfly',
    crowdFavorite: 'crowdFavorite',
    partyStarter: 'partyStarter',
    vibeKeeper: 'vibeKeeper',
    everyone: 'everyone',
  },
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

const mockShouldEmitCaptureBubble = vi.fn().mockReturnValue(false);
vi.mock('../../src/services/capture-trigger.js', () => ({
  shouldEmitCaptureBubble: (...args: unknown[]) => mockShouldEmitCaptureBubble(...args),
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

describe('session-manager icebreaker dispatch', () => {
  const mockQuestion = {
    id: 'fav-decade',
    question: "What's your music decade?",
    options: [
      { id: '80s', label: '80s', emoji: '🕺' },
      { id: '90s', label: '90s', emoji: '💿' },
      { id: '2000s', label: '2000s', emoji: '📀' },
      { id: '2010s', label: '2010s+', emoji: '🎧' },
    ],
  };

  const mockResult = {
    optionCounts: { '80s': 2, '90s': 1 },
    totalVotes: 3,
    winnerOptionId: '80s',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    // mockReset clears mockReturnValueOnce queue (clearAllMocks does not)
    mockProcessTransition.mockReset();
    vi.useFakeTimers();
    mockGetEventStream.mockReturnValue([]);
    mockDealIcebreakerQuestion.mockReturnValue(mockQuestion);
    mockResolveIcebreaker.mockReturnValue(mockResult);
    mockGetActiveConnections.mockReturnValue([
      { userId: 'user-1', displayName: 'User 1', isHost: true },
      { userId: 'user-2', displayName: 'User 2', isHost: false },
      { userId: 'user-3', displayName: 'User 3', isHost: false },
    ]);
  });

  afterEach(() => {
    vi.clearAllTimers();
    vi.useRealTimers();
  });

  describe('initializeDjState produces icebreaker state', () => {
    it('SESSION_STARTED transition results in icebreaker state', async () => {
      const lobbyContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.lobby,
      });
      const icebreakerContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.icebreaker,
        timerDurationMs: 6_000,
      });

      // createDJContext returns a lobby context
      const { createDJContext } = await import('../../src/dj-engine/machine.js');
      vi.mocked(createDJContext).mockReturnValue(lobbyContext);

      // SESSION_STARTED transitions to icebreaker
      mockProcessTransition.mockReturnValue({
        newContext: icebreakerContext,
        sideEffects: [{ type: 'persist', data: { context: icebreakerContext } }],
      });

      const { initializeDjState } = await import('../../src/services/session-manager.js');
      const { djContext } = await initializeDjState('session-1', 3);

      expect(djContext.state).toBe(DJState.icebreaker);
      expect(mockProcessTransition).toHaveBeenCalledWith(
        lobbyContext,
        { type: 'SESSION_STARTED' },
        expect.any(Number),
      );
    });
  });

  describe('onIcebreakerStateEntered', () => {
    it('deals question and broadcasts icebreaker:started with question, options, voteDurationMs', async () => {
      const icebreakerContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.icebreaker,
        timerDurationMs: 6_000,
      });

      const lobbyContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.lobby,
      });

      // Trigger onIcebreakerStateEntered via processDjTransition
      // When processDjTransition sees newContext.state === icebreaker, it calls onIcebreakerStateEntered
      mockGetSessionDjState.mockReturnValue(lobbyContext);
      mockProcessTransition.mockReturnValue({
        newContext: icebreakerContext,
        sideEffects: [],
      });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', lobbyContext, { type: 'SESSION_STARTED' });

      expect(mockDealIcebreakerQuestion).toHaveBeenCalled();
      expect(mockStartIcebreakerRound).toHaveBeenCalledWith('session-1', 'fav-decade', ['80s', '90s', '2000s', '2010s']);
      expect(mockBroadcastIcebreakerStarted).toHaveBeenCalledWith('session-1', {
        question: "What's your music decade?",
        options: [
          { id: '80s', label: '80s', emoji: '🕺' },
          { id: '90s', label: '90s', emoji: '💿' },
          { id: '2000s', label: '2000s', emoji: '📀' },
          { id: '2010s', label: '2010s+', emoji: '🎧' },
        ],
        voteDurationMs: 6_000,
      });
    });

    it('appends icebreaker:started event to event stream', async () => {
      const icebreakerContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.icebreaker,
        timerDurationMs: 6_000,
      });

      const lobbyContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.lobby,
      });

      mockGetSessionDjState.mockReturnValue(lobbyContext);
      mockProcessTransition.mockReturnValue({
        newContext: icebreakerContext,
        sideEffects: [],
      });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', lobbyContext, { type: 'SESSION_STARTED' });

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'icebreaker:started',
        data: { questionId: 'fav-decade' },
      }));
    });
  });

  describe('icebreaker timeout resolution', () => {
    it('resolves votes and broadcasts icebreaker:result after timeout', async () => {
      // We need to trigger resolveIcebreakerTimeout, which is called from handleRecoveryTimeout
      // when the DJ engine state is icebreaker. Since handleRecoveryTimeout is private,
      // we simulate it via the timer-scheduler mock callback.
      // But the actual flow: processDjTransition schedules timer → timer fires → handleRecoveryTimeout
      // → resolveIcebreakerTimeout → broadcasts result.
      //
      // We test this by entering icebreaker state, capturing the scheduleSessionTimer callback,
      // and invoking it.

      const mockSchedule = mockScheduleSessionTimer;

      const lobbyContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.lobby,
      });

      const icebreakerContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.icebreaker,
        timerDurationMs: 6_000,
        timerStartedAt: Date.now(),
      });

      mockGetSessionDjState.mockReturnValue(lobbyContext);
      mockProcessTransition.mockReturnValueOnce({
        newContext: icebreakerContext,
        sideEffects: [{ type: 'scheduleTimer', data: { durationMs: 6_000 } }],
      });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', lobbyContext, { type: 'SESSION_STARTED' });

      // scheduleSessionTimer should have been called with the timer callback
      expect(mockSchedule).toHaveBeenCalledWith('session-1', 6_000, expect.any(Function));

      // Now simulate the timer firing by calling the callback
      const timerCallback = mockSchedule.mock.calls[0]![2] as () => void;
      // When the callback fires, handleRecoveryTimeout retrieves current context
      mockGetSessionDjState.mockReturnValue(icebreakerContext);

      // The resolve will broadcast result, then schedule a reveal timer
      // After reveal delay (5s), ICEBREAKER_DONE is sent
      const songSelectionContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.songSelection,
      });
      mockProcessTransition.mockReturnValueOnce({
        newContext: songSelectionContext,
        sideEffects: [],
      });

      timerCallback();

      expect(mockResolveIcebreaker).toHaveBeenCalledWith('session-1', ['user-1', 'user-2', 'user-3']);
      expect(mockBroadcastIcebreakerResult).toHaveBeenCalledWith('session-1', mockResult);
    });

    it('appends icebreaker:result event to event stream', async () => {
      const mockSchedule = mockScheduleSessionTimer;

      const lobbyContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.lobby,
      });

      const icebreakerContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.icebreaker,
        timerDurationMs: 6_000,
        timerStartedAt: Date.now(),
      });

      mockGetSessionDjState.mockReturnValue(lobbyContext);
      mockProcessTransition.mockReturnValueOnce({
        newContext: icebreakerContext,
        sideEffects: [{ type: 'scheduleTimer', data: { durationMs: 6_000 } }],
      });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', lobbyContext, { type: 'SESSION_STARTED' });

      const timerCallback = mockSchedule.mock.calls[0]![2] as () => void;
      mockGetSessionDjState.mockReturnValue(icebreakerContext);

      mockProcessTransition.mockReturnValueOnce({
        newContext: createTestDJContext({ sessionId: 'session-1', state: DJState.songSelection }),
        sideEffects: [],
      });

      timerCallback();

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'icebreaker:result',
        data: mockResult,
      }));
    });
  });

  describe('reveal delay triggers ICEBREAKER_DONE', () => {
    it('after result reveal delay (5s), ICEBREAKER_DONE is triggered', async () => {
      const mockSchedule = mockScheduleSessionTimer;

      const lobbyContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.lobby,
      });

      const icebreakerContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.icebreaker,
        timerDurationMs: 6_000,
        timerStartedAt: Date.now(),
      });

      mockGetSessionDjState.mockReturnValue(lobbyContext);
      mockProcessTransition.mockReturnValueOnce({
        newContext: icebreakerContext,
        sideEffects: [{ type: 'scheduleTimer', data: { durationMs: 6_000 } }],
      });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', lobbyContext, { type: 'SESSION_STARTED' });

      const timerCallback = mockSchedule.mock.calls[0]![2] as () => void;
      // When timer fires, context is still icebreaker
      mockGetSessionDjState.mockReturnValue(icebreakerContext);

      const songSelectionContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.songSelection,
      });

      timerCallback();

      // ICEBREAKER_DONE should NOT have been called yet
      expect(mockProcessTransition).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: 'ICEBREAKER_DONE' }),
        expect.anything(),
      );

      // After 5s reveal delay, ICEBREAKER_DONE fires
      mockProcessTransition.mockReturnValueOnce({
        newContext: songSelectionContext,
        sideEffects: [],
      });

      vi.advanceTimersByTime(5_000);

      expect(mockProcessTransition).toHaveBeenCalledWith(
        icebreakerContext,
        { type: 'ICEBREAKER_DONE' },
        expect.any(Number),
      );
    });
  });

  describe('HOST_SKIP during icebreaker', () => {
    it('HOST_SKIP cancels icebreaker timers and resolves immediately', async () => {
      const mockSchedule = mockScheduleSessionTimer;

      const lobbyContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.lobby,
      });

      const icebreakerContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.icebreaker,
        timerDurationMs: 6_000,
        timerStartedAt: Date.now(),
      });

      mockGetSessionDjState.mockReturnValue(lobbyContext);
      mockProcessTransition.mockReturnValueOnce({
        newContext: icebreakerContext,
        sideEffects: [{ type: 'scheduleTimer', data: { durationMs: 6_000 } }],
      });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      // Enter icebreaker
      await processDjTransition('session-1', lobbyContext, { type: 'SESSION_STARTED' });

      // Now simulate timer firing → result is broadcast, reveal timer starts
      const timerCallback = mockSchedule.mock.calls[0]![2] as () => void;
      mockGetSessionDjState.mockReturnValue(icebreakerContext);

      const songSelectionContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.songSelection,
      });

      timerCallback();
      expect(mockBroadcastIcebreakerResult).toHaveBeenCalled();

      // HOST_SKIP while reveal timer is pending (icebreaker state)
      mockGetSessionDjState.mockReturnValue(icebreakerContext);
      mockProcessTransition.mockReturnValueOnce({
        newContext: songSelectionContext,
        sideEffects: [],
      });

      await processDjTransition('session-1', icebreakerContext, { type: 'HOST_SKIP' });

      // The reveal timer should be cleared — advancing 5s should NOT fire ICEBREAKER_DONE again
      mockProcessTransition.mockClear();
      vi.advanceTimersByTime(5_000);

      // No additional transition should have been triggered by the reveal timer
      expect(mockProcessTransition).not.toHaveBeenCalledWith(
        expect.anything(),
        expect.objectContaining({ type: 'ICEBREAKER_DONE' }),
        expect.anything(),
      );
    });
  });

  describe('capture bubble timing', () => {
    it('fires capture bubble 10s after icebreaker to songSelection transition (not 3s)', async () => {
      const icebreakerContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.icebreaker,
      });

      const songSelectionContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.songSelection,
      });

      mockProcessTransition.mockReturnValue({
        newContext: songSelectionContext,
        sideEffects: [],
      });

      // Enable capture bubble so emitCaptureBubble proceeds
      mockShouldEmitCaptureBubble.mockReturnValue(true);

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', icebreakerContext, { type: 'ICEBREAKER_DONE' });

      // Clear any calls from the transition itself (e.g. dj:stateChanged event)
      mockShouldEmitCaptureBubble.mockClear();

      // Not fired at 3s
      vi.advanceTimersByTime(3_000);
      expect(mockShouldEmitCaptureBubble).not.toHaveBeenCalled();

      // Fired at 10s total
      vi.advanceTimersByTime(7_000);
      expect(mockShouldEmitCaptureBubble).toHaveBeenCalledWith('session-1', DJState.songSelection);
    });
  });

  describe('session cleanup', () => {
    it('clears icebreaker session data during teardown', async () => {
      const lobbyContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.lobby,
      });
      const finaleContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.finale,
      });

      mockFindById.mockResolvedValue({ id: 'session-1', host_user_id: 'host-1' });
      mockGetSessionDjState.mockReturnValue(lobbyContext);
      mockProcessTransition.mockReturnValue({ newContext: finaleContext, sideEffects: [] });
      mockGetEventStream.mockReturnValue([]);

      const { endSession, finalizeSession } = await import('../../src/services/session-manager.js');
      await endSession('session-1', 'host-1');
      await finalizeSession('session-1');

      expect(mockClearIcebreakerSession).toHaveBeenCalledWith('session-1');
    });
  });
});
