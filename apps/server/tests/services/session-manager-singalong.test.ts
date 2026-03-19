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
  broadcastQuickVoteResult: vi.fn(),
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

vi.mock('../../src/services/quick-vote-dealer.js', () => ({
  dealQuestion: vi.fn().mockReturnValue({ id: 'mock-q', question: 'Mock?', optionA: 'A', optionB: 'B', emoji: '❓' }),
  startQuickVoteRound: vi.fn(),
  recordQuickVote: vi.fn().mockReturnValue({ recorded: true, firstVote: true }),
  resolveQuickVote: vi.fn(),
  clearSession: vi.fn(),
  resetAll: vi.fn(),
}));

const mockDealSingAlongPrompt = vi.fn();
const mockClearSingAlongSession = vi.fn();
vi.mock('../../src/services/singalong-dealer.js', () => ({
  dealPrompt: (...args: unknown[]) => mockDealSingAlongPrompt(...args),
  clearSession: (...args: unknown[]) => mockClearSingAlongSession(...args),
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

describe('session-manager group sing-along dispatch', () => {
  const mockPrompt = { id: 'bohemian-rhapsody', title: 'Bohemian Rhapsody', lyric: 'Is this the real life? Is this just fantasy?', emoji: '🎸' };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetEventStream.mockReturnValue([]);
    mockDealSingAlongPrompt.mockReturnValue(mockPrompt);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('startInterludeGame dispatches to executeGroupSingAlong', () => {
    it('dispatches to executeGroupSingAlong when selectedActivity is group_singalong', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'group_singalong' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'group_singalong',
        name: 'Group Sing-Along',
        description: '',
        icon: '🎤',
        universal: true,
        minParticipants: 2,
      });

      // Advance past reveal delay (5s)
      vi.advanceTimersByTime(5_000);

      expect(mockDealSingAlongPrompt).toHaveBeenCalledWith('session-1');
    });

    it('broadcasts interlude:gameStarted with prompt data mapped to card shape', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'group_singalong' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'group_singalong',
        name: 'Group Sing-Along',
        description: '',
        icon: '🎤',
        universal: true,
        minParticipants: 2,
      });

      vi.advanceTimersByTime(5_000);

      expect(mockBroadcastInterludeGameStarted).toHaveBeenCalledWith('session-1', {
        activityId: 'group_singalong',
        card: {
          id: 'bohemian-rhapsody',
          title: 'Bohemian Rhapsody',
          rule: 'Is this the real life? Is this just fantasy?',
          emoji: '🎸',
        },
        gameDurationMs: 15_000,
      });
    });

    it('gameDurationMs is 15000 (15 seconds)', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'group_singalong' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'group_singalong',
        name: 'Group Sing-Along',
        description: '',
        icon: '🎤',
        universal: true,
        minParticipants: 2,
      });

      vi.advanceTimersByTime(5_000);

      const call = mockBroadcastInterludeGameStarted.mock.calls[0];
      expect(call[1].gameDurationMs).toBe(15_000);
    });
  });

  describe('game timer', () => {
    it('fires after 15s and triggers endInterludeGame', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'group_singalong' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);
      mockProcessTransition.mockReturnValue({
        newContext: createTestDJContext({ sessionId: 'session-1', state: DJState.songSelection }),
        sideEffects: [],
      });

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'group_singalong',
        name: 'Group Sing-Along',
        description: '',
        icon: '🎤',
        universal: true,
        minParticipants: 2,
      });

      // Advance past reveal delay (5s)
      vi.advanceTimersByTime(5_000);
      expect(mockBroadcastInterludeGameEnded).not.toHaveBeenCalled();

      // Advance game timer (15s)
      vi.advanceTimersByTime(15_000);

      expect(mockBroadcastInterludeGameEnded).toHaveBeenCalledWith('session-1', {
        activityId: 'group_singalong',
      });
    });

    it('appends interlude:gameStarted event to event stream', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'group_singalong' },
      });

      mockGetSessionDjState.mockReturnValue(interludeContext);

      const { handleInterludeVoteWinner } = await import('../../src/services/session-manager.js');
      handleInterludeVoteWinner('session-1', {
        id: 'group_singalong',
        name: 'Group Sing-Along',
        description: '',
        icon: '🎤',
        universal: true,
        minParticipants: 2,
      });

      vi.advanceTimersByTime(5_000);

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'interlude:gameStarted',
        data: { activityId: 'group_singalong', cardId: 'bohemian-rhapsody' },
      }));
    });
  });

  describe('session cleanup', () => {
    it('clears sing-along session tracking during teardown', async () => {
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

      const { endSession } = await import('../../src/services/session-manager.js');
      await endSession('session-1', 'host-1');

      expect(mockClearSingAlongSession).toHaveBeenCalledWith('session-1');
    });
  });

  describe('HOST_SKIP during display', () => {
    it('cancels game timer when HOST_SKIP is processed', async () => {
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
        metadata: { selectedActivity: 'group_singalong' },
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
        id: 'group_singalong',
        name: 'Group Sing-Along',
        description: '',
        icon: '🎤',
        universal: true,
        minParticipants: 2,
      });

      // Advance past reveal delay (5s) — game starts
      vi.advanceTimersByTime(5_000);
      expect(mockBroadcastInterludeGameStarted).toHaveBeenCalled();

      // HOST_SKIP during display
      await processDjTransition('session-1', interludeContext, { type: 'HOST_SKIP' });

      // Advance past game duration — timer should NOT fire
      vi.advanceTimersByTime(15_000);

      // gameEnded should NOT be called since timer was cancelled by HOST_SKIP
      expect(mockBroadcastInterludeGameEnded).not.toHaveBeenCalled();
    });
  });
});
