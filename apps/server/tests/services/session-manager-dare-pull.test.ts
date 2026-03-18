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
  getIO: vi.fn(),
}));

vi.mock('../../src/services/kings-cup-dealer.js', () => ({
  dealCard: vi.fn().mockReturnValue({ id: 'mock-card', title: 'Mock', rule: 'Mock rule', emoji: '🃏' }),
  clearSession: vi.fn(),
  resetAll: vi.fn(),
}));

const mockDealDare = vi.fn();
const mockSelectTarget = vi.fn();
const mockClearDarePullSession = vi.fn();
vi.mock('../../src/services/dare-pull-dealer.js', () => ({
  dealDare: (...args: unknown[]) => mockDealDare(...args),
  selectTarget: (...args: unknown[]) => mockSelectTarget(...args),
  clearSession: (...args: unknown[]) => mockClearDarePullSession(...args),
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

describe('session-manager dare pull dispatch', () => {
  const mockDare = { id: 'air-guitar', title: 'Air Guitar Solo!', dare: 'Shred an imaginary guitar for 10 seconds', emoji: '🎸' };
  const mockTarget = { socketId: 'socket-1', userId: 'user-1', displayName: 'Alice', connectedAt: Date.now(), isHost: false };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetEventStream.mockReturnValue([]);
    mockDealDare.mockReturnValue(mockDare);
    mockSelectTarget.mockReturnValue(mockTarget);
    mockGetActiveConnections.mockReturnValue([mockTarget]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startInterludeGame dispatches to executeDarePull', () => {
    it('dispatches to executeDarePull when selectedActivity is dare_pull', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'dare_pull' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'dare_pull',
        name: 'Dare Pull',
        description: '',
        icon: '🎯',
        universal: false,
        minParticipants: 3,
      });

      // Advance past reveal delay (5s)
      vi.advanceTimersByTime(5_000);

      expect(mockGetActiveConnections).toHaveBeenCalledWith('session-1');
      expect(mockSelectTarget).toHaveBeenCalledWith('session-1', [mockTarget]);
      expect(mockDealDare).toHaveBeenCalledWith('session-1');
      expect(mockBroadcastInterludeGameStarted).toHaveBeenCalledWith('session-1', {
        activityId: 'dare_pull',
        card: { id: mockDare.id, title: mockDare.title, rule: mockDare.dare, emoji: mockDare.emoji },
        gameDurationMs: 15_000,
        targetUserId: 'user-1',
        targetDisplayName: 'Alice',
      });
    });

    it('broadcasts interlude:gameStarted with dare card data and target info', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'dare_pull' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'dare_pull',
        name: 'Dare Pull',
        description: '',
        icon: '🎯',
        universal: false,
        minParticipants: 3,
      });

      vi.advanceTimersByTime(5_000);

      const call = mockBroadcastInterludeGameStarted.mock.calls[0]!;
      const data = call[1] as { targetUserId: string; targetDisplayName: string; card: { rule: string } };
      expect(data.targetUserId).toBe('user-1');
      expect(data.targetDisplayName).toBe('Alice');
      expect(data.card.rule).toBe(mockDare.dare);
    });

    it('falls back to INTERLUDE_DONE when no active connections', async () => {
      mockGetActiveConnections.mockReturnValue([]);
      mockSelectTarget.mockReturnValue(null);

      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'dare_pull' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);
      mockProcessTransition.mockReturnValue({
        newContext: createTestDJContext({ sessionId: 'session-1', state: DJState.songSelection }),
        sideEffects: [],
      });

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'dare_pull',
        name: 'Dare Pull',
        description: '',
        icon: '🎯',
        universal: false,
        minParticipants: 3,
      });

      vi.advanceTimersByTime(5_000);

      expect(mockDealDare).not.toHaveBeenCalled();
      expect(mockBroadcastInterludeGameStarted).not.toHaveBeenCalled();
      expect(mockProcessTransition).toHaveBeenCalledWith(
        interludeContext,
        expect.objectContaining({ type: 'INTERLUDE_DONE' }),
        expect.any(Number),
      );
    });
  });

  describe('dare pull game timer', () => {
    it('fires gameEnded after 15s', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'dare_pull' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);
      mockProcessTransition.mockReturnValue({
        newContext: createTestDJContext({ sessionId: 'session-1', state: DJState.songSelection }),
        sideEffects: [],
      });

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'dare_pull',
        name: 'Dare Pull',
        description: '',
        icon: '🎯',
        universal: false,
        minParticipants: 3,
      });

      // Advance past reveal delay (5s) — starts game
      vi.advanceTimersByTime(5_000);
      expect(mockBroadcastInterludeGameEnded).not.toHaveBeenCalled();

      // Advance game timer (15s for dare pull)
      vi.advanceTimersByTime(15_000);

      expect(mockBroadcastInterludeGameEnded).toHaveBeenCalledWith('session-1', {
        activityId: 'dare_pull',
      });
    });

    it('triggers INTERLUDE_DONE after dare pull gameEnded', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'dare_pull' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);
      mockProcessTransition.mockReturnValue({
        newContext: createTestDJContext({ sessionId: 'session-1', state: DJState.songSelection }),
        sideEffects: [],
      });

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'dare_pull',
        name: 'Dare Pull',
        description: '',
        icon: '🎯',
        universal: false,
        minParticipants: 3,
      });

      // Advance past reveal (5s) + game (15s)
      vi.advanceTimersByTime(20_000);

      expect(mockProcessTransition).toHaveBeenCalledWith(
        interludeContext,
        expect.objectContaining({ type: 'INTERLUDE_DONE' }),
        expect.any(Number),
      );
    });
  });

  describe('session cleanup', () => {
    it('clears dare pull session data on session end', async () => {
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

      expect(mockClearDarePullSession).toHaveBeenCalledWith('session-1');
    });
  });

  describe('event stream', () => {
    it('appends interlude:gameStarted event with dare_pull activityId', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'dare_pull' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'dare_pull',
        name: 'Dare Pull',
        description: '',
        icon: '🎯',
        universal: false,
        minParticipants: 3,
      });

      vi.advanceTimersByTime(5_000);

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'interlude:gameStarted',
        data: { activityId: 'dare_pull', cardId: 'air-guitar' },
      }));
    });
  });
});
