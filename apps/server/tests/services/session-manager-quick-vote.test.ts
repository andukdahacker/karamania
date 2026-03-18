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
const mockBroadcastQuickVoteResult = vi.fn();
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
  broadcastQuickVoteResult: (...args: unknown[]) => mockBroadcastQuickVoteResult(...args),
  broadcastCardDealt: vi.fn(),
  broadcastQuickPickStarted: vi.fn(),
  broadcastSpinWheelStarted: vi.fn(),
  broadcastSpinWheelResult: vi.fn(),
  broadcastModeChanged: vi.fn(),
  getIO: vi.fn(),
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

const mockDealQuestion = vi.fn();
const mockStartQuickVoteRound = vi.fn();
const mockResolveQuickVote = vi.fn();
const mockClearQuickVoteSession = vi.fn();
vi.mock('../../src/services/quick-vote-dealer.js', () => ({
  dealQuestion: (...args: unknown[]) => mockDealQuestion(...args),
  startQuickVoteRound: (...args: unknown[]) => mockStartQuickVoteRound(...args),
  recordQuickVote: vi.fn().mockReturnValue({ recorded: true, firstVote: true }),
  resolveQuickVote: (...args: unknown[]) => mockResolveQuickVote(...args),
  clearSession: (...args: unknown[]) => mockClearQuickVoteSession(...args),
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

describe('session-manager quick vote dispatch', () => {
  const mockQuestion = { id: 'pineapple-pizza', question: 'Pineapple on pizza?', optionA: 'ALWAYS', optionB: 'NEVER', emoji: '🍕' };
  const mockResult = { optionACounts: 3, optionBCounts: 2, totalVotes: 5 };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetEventStream.mockReturnValue([]);
    mockDealQuestion.mockReturnValue(mockQuestion);
    mockResolveQuickVote.mockReturnValue(mockResult);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startInterludeGame dispatches to executeQuickVote', () => {
    it('dispatches to executeQuickVote when selectedActivity is quick_vote', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'quick_vote' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'quick_vote',
        name: 'Quick Vote',
        description: '',
        icon: '🗳️',
        universal: true,
        minParticipants: 2,
      });

      // Advance past reveal delay (5s)
      vi.advanceTimersByTime(5_000);

      expect(mockDealQuestion).toHaveBeenCalledWith('session-1');
      expect(mockStartQuickVoteRound).toHaveBeenCalledWith('session-1', mockQuestion.id);
    });

    it('broadcasts interlude:gameStarted with question data and quickVoteOptions', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'quick_vote' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'quick_vote',
        name: 'Quick Vote',
        description: '',
        icon: '🗳️',
        universal: true,
        minParticipants: 2,
      });

      vi.advanceTimersByTime(5_000);

      expect(mockBroadcastInterludeGameStarted).toHaveBeenCalledWith('session-1', {
        activityId: 'quick_vote',
        card: {
          id: mockQuestion.id,
          title: mockQuestion.question,
          rule: 'ALWAYS vs NEVER',
          emoji: mockQuestion.emoji,
        },
        gameDurationMs: 6_000,
        quickVoteOptions: [
          { id: 'A', label: 'ALWAYS' },
          { id: 'B', label: 'NEVER' },
        ],
      });
    });
  });

  describe('two-phase timer', () => {
    it('resolves votes after 6s voting window', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'quick_vote' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'quick_vote',
        name: 'Quick Vote',
        description: '',
        icon: '🗳️',
        universal: true,
        minParticipants: 2,
      });

      // Advance past reveal delay (5s)
      vi.advanceTimersByTime(5_000);
      expect(mockResolveQuickVote).not.toHaveBeenCalled();

      // Advance voting timer (6s)
      vi.advanceTimersByTime(6_000);

      expect(mockResolveQuickVote).toHaveBeenCalledWith('session-1');
    });

    it('broadcasts quickVoteResult after voting window', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'quick_vote' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'quick_vote',
        name: 'Quick Vote',
        description: '',
        icon: '🗳️',
        universal: true,
        minParticipants: 2,
      });

      // Advance past reveal (5s) + voting (6s)
      vi.advanceTimersByTime(11_000);

      expect(mockBroadcastQuickVoteResult).toHaveBeenCalledWith('session-1', mockResult);
    });

    it('broadcasts gameEnded after 5s reveal (total 11s from game start)', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'quick_vote' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);
      mockProcessTransition.mockReturnValue({
        newContext: createTestDJContext({ sessionId: 'session-1', state: DJState.songSelection }),
        sideEffects: [],
      });

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'quick_vote',
        name: 'Quick Vote',
        description: '',
        icon: '🗳️',
        universal: true,
        minParticipants: 2,
      });

      // Advance past reveal delay (5s) — game starts
      vi.advanceTimersByTime(5_000);
      expect(mockBroadcastInterludeGameEnded).not.toHaveBeenCalled();

      // Advance voting timer (6s)
      vi.advanceTimersByTime(6_000);
      expect(mockBroadcastInterludeGameEnded).not.toHaveBeenCalled();

      // Advance results reveal (5s)
      vi.advanceTimersByTime(5_000);

      expect(mockBroadcastInterludeGameEnded).toHaveBeenCalledWith('session-1', {
        activityId: 'quick_vote',
      });
    });

    it('triggers INTERLUDE_DONE after gameEnded', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'quick_vote' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);
      mockProcessTransition.mockReturnValue({
        newContext: createTestDJContext({ sessionId: 'session-1', state: DJState.songSelection }),
        sideEffects: [],
      });

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'quick_vote',
        name: 'Quick Vote',
        description: '',
        icon: '🗳️',
        universal: true,
        minParticipants: 2,
      });

      // Advance past reveal (5s) + voting (6s) + results reveal (5s)
      vi.advanceTimersByTime(16_000);

      expect(mockProcessTransition).toHaveBeenCalledWith(
        interludeContext,
        expect.objectContaining({ type: 'INTERLUDE_DONE' }),
        expect.any(Number),
      );
    });
  });

  describe('session cleanup', () => {
    it('clears quick vote session data on session end', async () => {
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

      expect(mockClearQuickVoteSession).toHaveBeenCalledWith('session-1');
    });
  });

  describe('event stream', () => {
    it('appends interlude:gameStarted event with quick_vote activityId', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'quick_vote' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'quick_vote',
        name: 'Quick Vote',
        description: '',
        icon: '🗳️',
        universal: true,
        minParticipants: 2,
      });

      vi.advanceTimersByTime(5_000);

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'interlude:gameStarted',
        data: { activityId: 'quick_vote', questionId: mockQuestion.id },
      }));
    });

    it('appends interlude:quickVoteResult event after voting window', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'quick_vote' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'quick_vote',
        name: 'Quick Vote',
        description: '',
        icon: '🗳️',
        universal: true,
        minParticipants: 2,
      });

      // Advance past reveal (5s) + voting (6s)
      vi.advanceTimersByTime(11_000);

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'interlude:quickVoteResult',
        data: mockResult,
      }));
    });
  });

  describe('HOST_SKIP during quick vote', () => {
    it('cancels voting timer on HOST_SKIP during voting phase', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'quick_vote' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);
      const songSelectionContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.songSelection,
      });
      mockProcessTransition.mockReturnValue({
        newContext: songSelectionContext,
        sideEffects: [],
      });

      const { handleInterludeVoteWinner, processDjTransition } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'quick_vote',
        name: 'Quick Vote',
        description: '',
        icon: '🗳️',
        universal: true,
        minParticipants: 2,
      });

      // Advance past reveal delay (5s) — game starts
      vi.advanceTimersByTime(5_000);
      expect(mockDealQuestion).toHaveBeenCalled();

      // HOST_SKIP during voting phase
      await processDjTransition('session-1', interludeContext, { type: 'HOST_SKIP' });

      // Advance past voting timer (6s) + reveal timer (5s) — should NOT fire
      vi.advanceTimersByTime(11_000);
      expect(mockResolveQuickVote).not.toHaveBeenCalled();
      expect(mockBroadcastQuickVoteResult).not.toHaveBeenCalled();
      expect(mockBroadcastInterludeGameEnded).not.toHaveBeenCalled();
    });

    it('cancels reveal timer on HOST_SKIP during results phase', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'quick_vote' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);
      const songSelectionContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.songSelection,
      });
      mockProcessTransition.mockReturnValue({
        newContext: songSelectionContext,
        sideEffects: [],
      });

      const { handleInterludeVoteWinner, processDjTransition } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'quick_vote',
        name: 'Quick Vote',
        description: '',
        icon: '🗳️',
        universal: true,
        minParticipants: 2,
      });

      // Advance past reveal delay (5s) + voting timer (6s) — now in results phase
      vi.advanceTimersByTime(11_000);
      expect(mockBroadcastQuickVoteResult).toHaveBeenCalled();
      mockBroadcastInterludeGameEnded.mockClear();
      mockProcessTransition.mockClear();
      mockProcessTransition.mockReturnValue({
        newContext: songSelectionContext,
        sideEffects: [],
      });

      // HOST_SKIP during results reveal phase
      await processDjTransition('session-1', interludeContext, { type: 'HOST_SKIP' });

      // Advance past results timer (5s) — should NOT fire
      vi.advanceTimersByTime(5_000);
      expect(mockBroadcastInterludeGameEnded).not.toHaveBeenCalled();
    });
  });

  describe('edge cases', () => {
    it('skips to endInterludeGame when resolveQuickVote returns null', async () => {
      mockResolveQuickVote.mockReturnValue(null);

      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'quick_vote' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);
      mockProcessTransition.mockReturnValue({
        newContext: createTestDJContext({ sessionId: 'session-1', state: DJState.songSelection }),
        sideEffects: [],
      });

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'quick_vote',
        name: 'Quick Vote',
        description: '',
        icon: '🗳️',
        universal: true,
        minParticipants: 2,
      });

      // Advance past reveal (5s) + voting (6s)
      vi.advanceTimersByTime(11_000);

      // Should NOT broadcast quickVoteResult
      expect(mockBroadcastQuickVoteResult).not.toHaveBeenCalled();
      // Should still broadcast gameEnded and INTERLUDE_DONE
      expect(mockBroadcastInterludeGameEnded).toHaveBeenCalledWith('session-1', {
        activityId: 'quick_vote',
      });
    });
  });
});
