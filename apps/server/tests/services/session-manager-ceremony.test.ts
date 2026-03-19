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

const mockBroadcastDjState = vi.fn();
const mockBroadcastCeremonyAnticipation = vi.fn();
const mockBroadcastCeremonyReveal = vi.fn();
const mockBroadcastCeremonyQuick = vi.fn();
vi.mock('../../src/services/dj-broadcaster.js', () => ({
  broadcastDjState: (...args: unknown[]) => mockBroadcastDjState(...args),
  broadcastDjPause: vi.fn(),
  broadcastDjResume: vi.fn(),
  broadcastCeremonyAnticipation: (...args: unknown[]) => mockBroadcastCeremonyAnticipation(...args),
  broadcastCeremonyReveal: (...args: unknown[]) => mockBroadcastCeremonyReveal(...args),
  broadcastCeremonyQuick: (...args: unknown[]) => mockBroadcastCeremonyQuick(...args),
  broadcastInterludeVoteStarted: vi.fn(),
  broadcastInterludeVoteResult: vi.fn(),
  broadcastInterludeGameStarted: vi.fn(),
  broadcastInterludeGameEnded: vi.fn(),
  broadcastQuickVoteResult: vi.fn(),
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
  dealQuestion: vi.fn().mockReturnValue({ id: 'mock-q', question: 'Mock?', optionA: 'YES', optionB: 'NO', emoji: '⚡' }),
  startQuickVoteRound: vi.fn(),
  recordQuickVote: vi.fn().mockReturnValue({ recorded: true, firstVote: true }),
  resolveQuickVote: vi.fn().mockReturnValue({ optionACounts: 3, optionBCounts: 2, totalVotes: 5 }),
  clearSession: vi.fn(),
  resetAll: vi.fn(),
}));

vi.mock('../../src/services/singalong-dealer.js', () => ({
  dealPrompt: vi.fn().mockReturnValue({ id: 'mock-prompt', title: 'Mock Song', lyric: 'Mock lyric line!', emoji: '🎤' }),
  clearSession: vi.fn(),
  resetAll: vi.fn(),
}));

vi.mock('../../src/services/icebreaker-dealer.js', () => ({
  dealQuestion: vi.fn().mockReturnValue({ id: 'mock-q', question: 'Mock?', options: [{ id: 'a', label: 'A', emoji: '🅰️' }, { id: 'b', label: 'B', emoji: '🅱️' }, { id: 'c', label: 'C', emoji: '©️' }, { id: 'd', label: 'D', emoji: '🇩' }] }),
  startIcebreakerRound: vi.fn(),
  recordIcebreakerVote: vi.fn().mockReturnValue({ recorded: true, firstVote: true }),
  resolveIcebreaker: vi.fn().mockReturnValue({ optionCounts: { a: 3, b: 2, c: 1, d: 0 }, totalVotes: 6, winnerOptionId: 'a' }),
  clearSession: vi.fn(),
  resetAll: vi.fn(),
}));

vi.mock('../../src/services/activity-voter.js', () => ({
  selectActivityOptions: vi.fn().mockReturnValue([{ id: 'mock', name: 'Mock', description: '', icon: '', universal: true, minParticipants: 2 }]),
  startVoteRound: vi.fn(),
  resolveByTimeout: vi.fn(),
  getVoteCounts: vi.fn().mockReturnValue({}),
  clearSession: vi.fn(),
  resetAllRounds: vi.fn(),
}));

vi.mock('../../src/services/connection-tracker.js', () => ({
  removeSession: vi.fn(),
  getActiveConnections: vi.fn(),
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
const mockGetEventStream = vi.fn();
vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
  flushEventStream: (...args: unknown[]) => mockFlushEventStream(...args),
  getEventStream: (...args: unknown[]) => mockGetEventStream(...args),
}));

vi.mock('../../src/services/activity-tracker.js', () => ({
  removeSession: vi.fn(),
}));

vi.mock('../../src/services/capture-trigger.js', () => ({
  shouldEmitCaptureBubble: vi.fn().mockReturnValue(false),
  markBubbleEmitted: vi.fn(),
  clearCaptureTriggerState: vi.fn(),
}));

describe('session-manager ceremony orchestration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockGetEventStream.mockReturnValue([]);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('orchestrateFullCeremony via processDjTransition', () => {
    it('calls broadcastCeremonyAnticipation when entering ceremony with type full', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: DJState.song });
      const newContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
        currentPerformer: null,
        metadata: { ceremonyType: 'full', lastCeremonyType: 'full' },
      });

      mockProcessTransition.mockReturnValue({ newContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_ENDED' });

      expect(mockBroadcastCeremonyAnticipation).toHaveBeenCalledWith('session-1', {
        performerName: null,
        revealAt: expect.any(Number),
      });
    });

    it('revealAt is approximately now + 2000ms', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: DJState.song });
      const newContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
        metadata: { ceremonyType: 'full', lastCeremonyType: 'full' },
      });

      mockProcessTransition.mockReturnValue({ newContext, sideEffects: [] });

      const now = Date.now();
      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_ENDED' });

      const revealAt = mockBroadcastCeremonyAnticipation.mock.calls[0]?.[1]?.revealAt as number;
      expect(revealAt).toBeGreaterThanOrEqual(now + 2000);
      expect(revealAt).toBeLessThanOrEqual(now + 2100);
    });

    it('broadcasts ceremony:reveal after ~2000ms delay', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: DJState.song });
      const newContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
        currentPerformer: null,
        metadata: { ceremonyType: 'full', lastCeremonyType: 'full' },
      });

      mockProcessTransition.mockReturnValue({ newContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_ENDED' });

      expect(mockBroadcastCeremonyReveal).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2000);

      expect(mockBroadcastCeremonyReveal).toHaveBeenCalledWith('session-1', {
        award: 'Star of the Show',
        performerName: null,
        tone: 'hype',
        songTitle: null,
      });
    });

    it('includes songTitle from context in reveal broadcast', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: DJState.song });
      const newContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
        currentPerformer: 'Alice',
        currentSongTitle: 'Bohemian Rhapsody',
        metadata: { ceremonyType: 'full', lastCeremonyType: 'full' },
      });

      mockProcessTransition.mockReturnValue({ newContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_ENDED' });

      vi.advanceTimersByTime(2000);

      expect(mockBroadcastCeremonyReveal).toHaveBeenCalledWith('session-1', expect.objectContaining({
        songTitle: 'Bohemian Rhapsody',
      }));
    });

    it('includes songTitle: null in reveal broadcast when currentSongTitle is null', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: DJState.song });
      const newContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
        currentPerformer: null,
        currentSongTitle: null,
        metadata: { ceremonyType: 'full', lastCeremonyType: 'full' },
      });

      mockProcessTransition.mockReturnValue({ newContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_ENDED' });

      vi.advanceTimersByTime(2000);

      expect(mockBroadcastCeremonyReveal).toHaveBeenCalledWith('session-1', expect.objectContaining({
        songTitle: null,
      }));
    });

    it('uses fallback award when no performer is identified', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: DJState.song });
      const newContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
        currentPerformer: null,
        metadata: { ceremonyType: 'full', lastCeremonyType: 'full' },
      });

      mockProcessTransition.mockReturnValue({ newContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_ENDED' });

      vi.advanceTimersByTime(2000);

      expect(mockBroadcastCeremonyReveal).toHaveBeenCalledWith('session-1', expect.objectContaining({
        award: 'Star of the Show',
      }));
    });

    it('appends ceremony:revealed event to event stream after reveal', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: DJState.song });
      const newContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
        currentPerformer: null,
        metadata: { ceremonyType: 'full', lastCeremonyType: 'full' },
      });

      mockProcessTransition.mockReturnValue({ newContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_ENDED' });

      vi.advanceTimersByTime(2000);

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'ceremony:revealed',
        data: expect.objectContaining({
          award: 'Star of the Show',
          performerName: null,
          ceremonyType: 'full',
          songTitle: null,
        }),
      }));
    });

    it('does NOT call full ceremony functions when type is quick', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: DJState.song });
      const newContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
        metadata: { ceremonyType: 'quick', lastCeremonyType: 'quick' },
      });

      mockProcessTransition.mockReturnValue({ newContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_ENDED' });

      expect(mockBroadcastCeremonyAnticipation).not.toHaveBeenCalled();

      vi.advanceTimersByTime(5000);

      expect(mockBroadcastCeremonyReveal).not.toHaveBeenCalled();
    });

    it('calls orchestrateQuickCeremony when entering ceremony with type quick', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: DJState.song });
      const newContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
        currentPerformer: null,
        metadata: { ceremonyType: 'quick', lastCeremonyType: 'quick' },
      });

      mockProcessTransition.mockReturnValue({ newContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_ENDED' });

      expect(mockBroadcastCeremonyQuick).toHaveBeenCalledWith('session-1', {
        award: 'Star of the Show',
        performerName: null,
        tone: 'hype',
      });
    });
  });

  describe('orchestrateQuickCeremony', () => {
    it('emits ceremony:quick event immediately with award data', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: DJState.song });
      const newContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
        currentPerformer: 'Alice',
        metadata: { ceremonyType: 'quick', lastCeremonyType: 'quick' },
      });

      mockProcessTransition.mockReturnValue({ newContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_ENDED' });

      // Quick ceremony broadcasts immediately — no delay
      expect(mockBroadcastCeremonyQuick).toHaveBeenCalledWith('session-1', {
        award: 'Star of the Show',
        performerName: 'Alice',
        tone: 'hype',
      });
    });

    it('uses fallback award when no performer is identified', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: DJState.song });
      const newContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
        currentPerformer: null,
        metadata: { ceremonyType: 'quick', lastCeremonyType: 'quick' },
      });

      mockProcessTransition.mockReturnValue({ newContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_ENDED' });

      expect(mockBroadcastCeremonyQuick).toHaveBeenCalledWith('session-1', expect.objectContaining({
        award: 'Star of the Show',
        tone: 'hype',
      }));
    });

    it('appends ceremony:revealed event with ceremonyType quick', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: DJState.song });
      const newContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
        currentPerformer: null,
        metadata: { ceremonyType: 'quick', lastCeremonyType: 'quick' },
      });

      mockProcessTransition.mockReturnValue({ newContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_ENDED' });

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'ceremony:revealed',
        data: expect.objectContaining({
          award: 'Star of the Show',
          performerName: null,
          ceremonyType: 'quick',
          songTitle: null,
        }),
      }));
    });

    it('schedules auto-advance after 10s', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: DJState.song });
      const newContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
        metadata: { ceremonyType: 'quick', lastCeremonyType: 'quick' },
      });

      mockProcessTransition.mockReturnValue({ newContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_ENDED' });

      // Before 10s — no auto-advance
      const ceremonyDoneContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
      });
      mockGetSessionDjState.mockReturnValue(ceremonyDoneContext);
      mockProcessTransition.mockReturnValue({
        newContext: createTestDJContext({ sessionId: 'session-1', state: DJState.interlude }),
        sideEffects: [],
      });

      // Advance past capture bubble timer (3s) then clear call history
      vi.advanceTimersByTime(3001);
      mockGetSessionDjState.mockClear();

      vi.advanceTimersByTime(6998);
      expect(mockGetSessionDjState).not.toHaveBeenCalled();

      // At 10s — auto-advance fires
      await vi.advanceTimersByTimeAsync(1);

      expect(mockGetSessionDjState).toHaveBeenCalledWith('session-1');
    });

    it('auto-advance calls processDjTransition with CEREMONY_DONE event', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: DJState.song });
      const newContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
        metadata: { ceremonyType: 'quick', lastCeremonyType: 'quick' },
      });

      mockProcessTransition.mockReturnValueOnce({ newContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_ENDED' });

      const currentContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
      });
      mockGetSessionDjState.mockReturnValue(currentContext);
      mockProcessTransition.mockReturnValueOnce({
        newContext: createTestDJContext({ sessionId: 'session-1', state: DJState.interlude }),
        sideEffects: [],
      });

      await vi.advanceTimersByTimeAsync(10_000);

      // processDjTransition called twice: once for SONG_ENDED, once for CEREMONY_DONE
      expect(mockProcessTransition).toHaveBeenCalledTimes(2);
    });

    it('auto-advance does not fire if session ended (getSessionDjState returns null)', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: DJState.song });
      const newContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
        metadata: { ceremonyType: 'quick', lastCeremonyType: 'quick' },
      });

      mockProcessTransition.mockReturnValue({ newContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_ENDED' });

      // Session ended — context is null
      mockGetSessionDjState.mockReturnValue(null);

      await vi.advanceTimersByTimeAsync(10_000);

      // processDjTransition should only have been called once (for SONG_ENDED)
      expect(mockProcessTransition).toHaveBeenCalledTimes(1);
    });

    it('auto-advance does not fire if state is no longer ceremony (HOST_SKIP raced)', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: DJState.song });
      const newContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
        metadata: { ceremonyType: 'quick', lastCeremonyType: 'quick' },
      });

      mockProcessTransition.mockReturnValue({ newContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_ENDED' });

      // Already transitioned out of ceremony
      mockGetSessionDjState.mockReturnValue(createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
      }));

      await vi.advanceTimersByTimeAsync(10_000);

      // processDjTransition should only have been called once (for SONG_ENDED)
      expect(mockProcessTransition).toHaveBeenCalledTimes(1);
    });

    it('auto-advance gracefully handles processDjTransition throwing', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: DJState.song });
      const newContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
        metadata: { ceremonyType: 'quick', lastCeremonyType: 'quick' },
      });

      mockProcessTransition.mockReturnValueOnce({ newContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_ENDED' });

      const currentContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
      });
      mockGetSessionDjState.mockReturnValue(currentContext);

      // Simulate DJEngineError from validateTransitionAllowed
      mockProcessTransition.mockImplementationOnce(() => {
        throw new Error('INVALID_TRANSITION');
      });

      // Should not throw — error is caught gracefully
      await vi.advanceTimersByTimeAsync(10_000);
    });
  });

  describe('clearCeremonyTimers', () => {
    it('cancels pending reveal timer when HOST_SKIP fires during full ceremony', async () => {
      const songContext = createTestDJContext({ sessionId: 'session-1', state: DJState.song });
      const ceremonyContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
        metadata: { ceremonyType: 'full', lastCeremonyType: 'full' },
      });

      mockProcessTransition.mockReturnValueOnce({ newContext: ceremonyContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', songContext, { type: 'SONG_ENDED' });

      expect(mockBroadcastCeremonyAnticipation).toHaveBeenCalled();

      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
      });
      mockProcessTransition.mockReturnValueOnce({ newContext: interludeContext, sideEffects: [] });

      await processDjTransition('session-1', ceremonyContext, { type: 'HOST_SKIP' });

      vi.advanceTimersByTime(5000);

      expect(mockBroadcastCeremonyReveal).not.toHaveBeenCalled();
    });

    it('cancels pending quick ceremony auto-advance timer when HOST_SKIP fires', async () => {
      const songContext = createTestDJContext({ sessionId: 'session-1', state: DJState.song });
      const ceremonyContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
        metadata: { ceremonyType: 'quick', lastCeremonyType: 'quick' },
      });

      mockProcessTransition.mockReturnValueOnce({ newContext: ceremonyContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', songContext, { type: 'SONG_ENDED' });

      expect(mockBroadcastCeremonyQuick).toHaveBeenCalled();

      // HOST_SKIP out of ceremony — should clear quick ceremony timer
      const interludeContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.interlude,
      });
      mockProcessTransition.mockReturnValueOnce({ newContext: interludeContext, sideEffects: [] });

      await processDjTransition('session-1', ceremonyContext, { type: 'HOST_SKIP' });

      // Advance past 10s — auto-advance should NOT fire because timer was cleared
      mockGetSessionDjState.mockReturnValue(null);
      await vi.advanceTimersByTimeAsync(15_000);

      // processDjTransition was called twice (SONG_ENDED + HOST_SKIP), not a third time
      expect(mockProcessTransition).toHaveBeenCalledTimes(2);
    });
  });

  describe('ceremony state config', () => {
    it('ceremony state isPlaceholder is false', async () => {
      const { getStateConfig } = await import('../../src/dj-engine/states.js');
      const config = getStateConfig(DJState.ceremony);
      expect(config.isPlaceholder).toBe(false);
    });
  });
});
