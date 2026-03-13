import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestSession } from '../factories/session.js';
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

const mockGenerateUniquePartyCode = vi.fn();
vi.mock('../../src/services/party-code.js', () => ({
  generateUniquePartyCode: mockGenerateUniquePartyCode,
}));

const mockFindById = vi.fn();
const mockUpdateDjState = vi.fn();
const mockGetParticipants = vi.fn();
const mockUpdateStatus = vi.fn();
const mockRemoveParticipant = vi.fn();
const mockWriteEventStream = vi.fn();
vi.mock('../../src/persistence/session-repository.js', () => ({
  create: vi.fn(),
  addParticipant: vi.fn(),
  addParticipantIfNotExists: vi.fn(),
  getParticipants: mockGetParticipants,
  findById: mockFindById,
  updateStatus: mockUpdateStatus,
  updateHost: vi.fn(),
  updateDjState: mockUpdateDjState,
  removeParticipant: (...args: unknown[]) => mockRemoveParticipant(...args),
  writeEventStream: (...args: unknown[]) => mockWriteEventStream(...args),
  incrementParticipationScore: vi.fn().mockResolvedValue(undefined),
  getParticipantScore: vi.fn(),
}));

const mockCreateDJContext = vi.fn();
const mockProcessTransition = vi.fn();
vi.mock('../../src/dj-engine/machine.js', () => ({
  createDJContext: mockCreateDJContext,
  processTransition: mockProcessTransition,
}));

const mockDeserializeDJContext = vi.fn();
vi.mock('../../src/dj-engine/serializer.js', () => ({
  deserializeDJContext: mockDeserializeDJContext,
  serializeDJContext: (ctx: unknown) => ctx,
}));

const mockSetSessionDjState = vi.fn();
const mockGetSessionDjState = vi.fn();
const mockRemoveSessionDjState = vi.fn();
vi.mock('../../src/services/dj-state-store.js', () => ({
  getSessionDjState: (...args: unknown[]) => mockGetSessionDjState(...args),
  setSessionDjState: (...args: unknown[]) => mockSetSessionDjState(...args),
  removeSessionDjState: (...args: unknown[]) => mockRemoveSessionDjState(...args),
}));

const mockScheduleSessionTimer = vi.fn();
const mockCancelSessionTimer = vi.fn();
const mockPauseSessionTimer = vi.fn();
const mockResumeSessionTimer = vi.fn();
vi.mock('../../src/services/timer-scheduler.js', () => ({
  scheduleSessionTimer: (...args: unknown[]) => mockScheduleSessionTimer(...args),
  cancelSessionTimer: (...args: unknown[]) => mockCancelSessionTimer(...args),
  pauseSessionTimer: (...args: unknown[]) => mockPauseSessionTimer(...args),
  resumeSessionTimer: (...args: unknown[]) => mockResumeSessionTimer(...args),
}));

const mockBroadcastDjState = vi.fn();
const mockBroadcastDjPause = vi.fn();
const mockBroadcastDjResume = vi.fn();
const mockBroadcastCeremonyAnticipation = vi.fn();
const mockBroadcastCeremonyReveal = vi.fn();
const mockBroadcastCeremonyQuick = vi.fn();
vi.mock('../../src/services/dj-broadcaster.js', () => ({
  broadcastDjState: (...args: unknown[]) => mockBroadcastDjState(...args),
  broadcastDjPause: (...args: unknown[]) => mockBroadcastDjPause(...args),
  broadcastDjResume: (...args: unknown[]) => mockBroadcastDjResume(...args),
  broadcastCeremonyAnticipation: (...args: unknown[]) => mockBroadcastCeremonyAnticipation(...args),
  broadcastCeremonyReveal: (...args: unknown[]) => mockBroadcastCeremonyReveal(...args),
  broadcastCeremonyQuick: (...args: unknown[]) => mockBroadcastCeremonyQuick(...args),
}));

const mockRemoveSession = vi.fn();
vi.mock('../../src/services/connection-tracker.js', () => ({
  removeSession: (...args: unknown[]) => mockRemoveSession(...args),
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
vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
  flushEventStream: (...args: unknown[]) => mockFlushEventStream(...args),
}));

vi.mock('../../src/services/activity-tracker.js', () => ({
  removeSession: vi.fn(),
}));

const mockClearSessionStreaks = vi.fn();
vi.mock('../../src/services/streak-tracker.js', () => ({
  clearSessionStreaks: (...args: unknown[]) => mockClearSessionStreaks(...args),
  clearUserStreak: vi.fn(),
  clearStreakStore: vi.fn(),
}));

describe('session-manager DJ functions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('persistDjState', () => {
    it('calls sessionRepo.updateDjState with correct args', async () => {
      mockUpdateDjState.mockResolvedValue(undefined);

      const { persistDjState } = await import('../../src/services/session-manager.js');
      const serializedState = { state: 'songSelection', sessionId: 'session-1' };
      await persistDjState('session-1', serializedState);

      expect(mockUpdateDjState).toHaveBeenCalledWith('session-1', serializedState);
    });

    it('catches and logs errors without throwing', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
      mockUpdateDjState.mockRejectedValue(new Error('DB connection lost'));

      const { persistDjState } = await import('../../src/services/session-manager.js');
      await expect(persistDjState('session-1', { state: 'lobby' })).resolves.toBeUndefined();

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to persist DJ state'),
        expect.any(Error),
      );
      warnSpy.mockRestore();
    });
  });

  describe('initializeDjState', () => {
    it('creates context, transitions to songSelection, persists, and returns { djContext, sideEffects }', async () => {
      const lobbyContext = createTestDJContext({ sessionId: 'session-1', participantCount: 5 });
      const songSelectionContext = createTestDJContext({
        sessionId: 'session-1',
        participantCount: 5,
        state: 'songSelection' as const,
      });
      const sideEffects = [
        { type: 'cancelTimer', data: {} },
        { type: 'broadcast', data: { from: 'lobby', to: 'songSelection' } },
        { type: 'persist', data: { context: { state: 'songSelection' } } },
      ];

      mockCreateDJContext.mockReturnValue(lobbyContext);
      mockProcessTransition.mockReturnValue({ newContext: songSelectionContext, sideEffects });
      mockUpdateDjState.mockResolvedValue(undefined);

      const { initializeDjState } = await import('../../src/services/session-manager.js');
      const result = await initializeDjState('session-1', 5);

      expect(mockCreateDJContext).toHaveBeenCalledWith('session-1', 5);
      expect(mockProcessTransition).toHaveBeenCalledWith(lobbyContext, { type: 'SESSION_STARTED' }, expect.any(Number));
      expect(mockUpdateDjState).toHaveBeenCalledWith('session-1', { state: 'songSelection' });
      expect(result.djContext).toEqual(songSelectionContext);
      expect(result.sideEffects).toEqual(sideEffects);
    });

    it('stores context in dj-state-store', async () => {
      const lobbyContext = createTestDJContext({ sessionId: 'session-1', participantCount: 5 });
      const songSelectionContext = createTestDJContext({
        sessionId: 'session-1',
        participantCount: 5,
        state: 'songSelection' as const,
      });

      mockCreateDJContext.mockReturnValue(lobbyContext);
      mockProcessTransition.mockReturnValue({
        newContext: songSelectionContext,
        sideEffects: [],
      });

      const { initializeDjState } = await import('../../src/services/session-manager.js');
      await initializeDjState('session-1', 5);

      expect(mockSetSessionDjState).toHaveBeenCalledWith('session-1', songSelectionContext);
    });

    it('does not call persistDjState when no persist side effect is returned', async () => {
      const lobbyContext = createTestDJContext({ sessionId: 'session-1', participantCount: 5 });
      const songSelectionContext = createTestDJContext({
        sessionId: 'session-1',
        participantCount: 5,
        state: 'songSelection' as const,
      });

      mockCreateDJContext.mockReturnValue(lobbyContext);
      mockProcessTransition.mockReturnValue({
        newContext: songSelectionContext,
        sideEffects: [
          { type: 'cancelTimer', data: {} },
          { type: 'broadcast', data: { from: 'lobby', to: 'songSelection' } },
        ],
      });

      const { initializeDjState } = await import('../../src/services/session-manager.js');
      await initializeDjState('session-1', 5);

      expect(mockUpdateDjState).not.toHaveBeenCalled();
    });
  });

  describe('loadDjState', () => {
    it('returns deserialized DJContext when dj_state exists', async () => {
      const storedState = { state: 'songSelection', sessionId: 'session-1' };
      const deserializedContext = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      mockFindById.mockResolvedValue(createTestSession({ id: 'session-1', dj_state: storedState }));
      mockDeserializeDJContext.mockReturnValue(deserializedContext);

      const { loadDjState } = await import('../../src/services/session-manager.js');
      const result = await loadDjState('session-1');

      expect(mockDeserializeDJContext).toHaveBeenCalledWith(storedState);
      expect(result).toEqual(deserializedContext);
    });

    it('returns null when session not found', async () => {
      mockFindById.mockResolvedValue(undefined);

      const { loadDjState } = await import('../../src/services/session-manager.js');
      const result = await loadDjState('nonexistent');

      expect(result).toBeNull();
    });

    it('returns null when dj_state is null', async () => {
      mockFindById.mockResolvedValue(createTestSession({ id: 'session-1', dj_state: null }));

      const { loadDjState } = await import('../../src/services/session-manager.js');
      const result = await loadDjState('session-1');

      expect(result).toBeNull();
      expect(mockDeserializeDJContext).not.toHaveBeenCalled();
    });

    it('returns null and logs on deserialization failure', async () => {
      const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
      mockFindById.mockResolvedValue(createTestSession({ id: 'session-1', dj_state: { invalid: true } }));
      mockDeserializeDJContext.mockImplementation(() => {
        throw new Error('Invalid DJ context');
      });

      const { loadDjState } = await import('../../src/services/session-manager.js');
      const result = await loadDjState('session-1');

      expect(result).toBeNull();
      expect(errorSpy).toHaveBeenCalledWith(
        expect.stringContaining('Failed to deserialize DJ state'),
        expect.any(Error),
      );
      errorSpy.mockRestore();
    });
  });

  describe('processDjTransition', () => {
    it('calls processTransition, extracts persist effect, fires persistDjState', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      const newContext = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });
      const serializedContext = { state: 'song', sessionId: 'session-1' };
      const sideEffects = [
        { type: 'cancelTimer', data: {} },
        { type: 'broadcast', data: { from: 'songSelection', to: 'song' } },
        { type: 'persist', data: { context: serializedContext } },
      ];

      mockProcessTransition.mockReturnValue({ newContext, sideEffects });
      mockUpdateDjState.mockResolvedValue(undefined);

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      const result = await processDjTransition('session-1', context, { type: 'SONG_SELECTED' });

      expect(mockProcessTransition).toHaveBeenCalledWith(context, { type: 'SONG_SELECTED' }, expect.any(Number));
      expect(mockUpdateDjState).toHaveBeenCalledWith('session-1', serializedContext);
      expect(result.newContext).toEqual(newContext);
      expect(result.sideEffects).toEqual(sideEffects);
    });

    it('does not call persistDjState when no persist side effect is returned', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      const newContext = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });

      mockProcessTransition.mockReturnValue({
        newContext,
        sideEffects: [
          { type: 'cancelTimer', data: {} },
          { type: 'broadcast', data: { from: 'songSelection', to: 'song' } },
        ],
      });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_SELECTED' });

      expect(mockUpdateDjState).not.toHaveBeenCalled();
    });

    it('handles scheduleTimer side effect by calling scheduleSessionTimer', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      const newContext = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });

      mockProcessTransition.mockReturnValue({
        newContext,
        sideEffects: [
          { type: 'scheduleTimer', data: { durationMs: 180_000 } },
        ],
      });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_SELECTED' });

      expect(mockScheduleSessionTimer).toHaveBeenCalledWith(
        'session-1',
        180_000,
        expect.any(Function),
      );
    });

    it('handles cancelTimer side effect by calling cancelSessionTimer', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });
      const newContext = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });

      mockProcessTransition.mockReturnValue({
        newContext,
        sideEffects: [
          { type: 'cancelTimer', data: {} },
        ],
      });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'TIMEOUT' });

      expect(mockCancelSessionTimer).toHaveBeenCalledWith('session-1');
    });

    it('handles broadcast side effect by calling broadcastDjState', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      const newContext = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });

      mockProcessTransition.mockReturnValue({
        newContext,
        sideEffects: [
          { type: 'broadcast', data: { from: 'songSelection', to: 'song' } },
        ],
      });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_SELECTED' });

      expect(mockBroadcastDjState).toHaveBeenCalledWith('session-1', newContext);
    });

    it('stores new context in dj-state-store', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      const newContext = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });

      mockProcessTransition.mockReturnValue({
        newContext,
        sideEffects: [],
      });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_SELECTED' });

      expect(mockSetSessionDjState).toHaveBeenCalledWith('session-1', newContext);
    });

    it('persist is fire-and-forget (not awaited in the response path)', async () => {
      const context = createTestDJContext({ sessionId: 'session-1' });
      const newContext = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });

      // Make persist slow -- if it were awaited, the test would timeout or we'd see ordering issues
      let persistResolved = false;
      mockUpdateDjState.mockImplementation(() => new Promise(resolve => {
        setTimeout(() => {
          persistResolved = true;
          resolve(undefined);
        }, 100);
      }));

      mockProcessTransition.mockReturnValue({
        newContext,
        sideEffects: [
          { type: 'persist', data: { context: { state: 'song' } } },
        ],
      });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      const result = await processDjTransition('session-1', context, { type: 'SONG_SELECTED' });

      // Result should return immediately without waiting for persist
      expect(result.newContext).toEqual(newContext);
      expect(persistResolved).toBe(false); // persist hasn't resolved yet -- fire-and-forget
    });

    it('calls clearSessionStreaks when transitioning FROM song to another state', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });
      const newContext = createTestDJContext({ sessionId: 'session-1', state: 'ceremony' as const });

      mockProcessTransition.mockReturnValue({
        newContext,
        sideEffects: [],
      });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_ENDED' });

      expect(mockClearSessionStreaks).toHaveBeenCalledWith('session-1');
    });

    it('does NOT call clearSessionStreaks when transitioning TO song', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      const newContext = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });

      mockProcessTransition.mockReturnValue({
        newContext,
        sideEffects: [],
      });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_SELECTED' });

      expect(mockClearSessionStreaks).not.toHaveBeenCalled();
    });

    it('does NOT call clearSessionStreaks for transitions not involving song', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'lobby' as const });
      const newContext = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });

      mockProcessTransition.mockReturnValue({
        newContext,
        sideEffects: [],
      });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SESSION_STARTED' });

      expect(mockClearSessionStreaks).not.toHaveBeenCalled();
    });
  });

  describe('endSession', () => {
    it('transitions to finale, updates DB, and cleans up in-memory state', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });
      const finaleContext = createTestDJContext({ sessionId: 'session-1', state: 'finale' as const });

      mockFindById.mockResolvedValue(session);
      mockGetSessionDjState.mockReturnValue(context);
      mockProcessTransition.mockReturnValue({
        newContext: finaleContext,
        sideEffects: [
          { type: 'cancelTimer', data: {} },
          { type: 'broadcast', data: { from: 'song', to: 'finale' } },
          { type: 'persist', data: { context: { state: 'finale' } } },
        ],
      });
      mockUpdateStatus.mockResolvedValue(undefined);
      mockFlushEventStream.mockReturnValue([]);

      const { endSession } = await import('../../src/services/session-manager.js');
      const result = await endSession('session-1', 'host-user-1');

      expect(result).toEqual(finaleContext);
      expect(mockProcessTransition).toHaveBeenCalledWith(context, { type: 'END_PARTY' }, expect.any(Number));
      expect(mockUpdateStatus).toHaveBeenCalledWith('session-1', 'ended');
      expect(mockRemoveSessionDjState).toHaveBeenCalledWith('session-1');
      expect(mockCancelSessionTimer).toHaveBeenCalledWith('session-1');
      expect(mockRemoveSession).toHaveBeenCalledWith('session-1');
    });

    it('throws when no active DJ state exists', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      mockFindById.mockResolvedValue(session);
      mockGetSessionDjState.mockReturnValue(undefined);

      const { endSession } = await import('../../src/services/session-manager.js');
      await expect(endSession('session-1', 'host-user-1')).rejects.toThrow();
    });

    it('rejects non-host callers', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      mockFindById.mockResolvedValue(session);

      const { endSession } = await import('../../src/services/session-manager.js');
      await expect(endSession('session-1', 'not-host')).rejects.toThrow();
    });
  });

  describe('kickPlayer', () => {
    it('removes participant and decrements DJ context participantCount', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      const context = createTestDJContext({ sessionId: 'session-1', participantCount: 5 });

      mockFindById.mockResolvedValue(session);
      mockRemoveParticipant.mockResolvedValue(undefined);
      mockGetSessionDjState.mockReturnValue(context);
      mockUpdateDjState.mockResolvedValue(undefined);

      const { kickPlayer } = await import('../../src/services/session-manager.js');
      const result = await kickPlayer('session-1', 'host-user-1', 'target-user-1');

      expect(result).toEqual({ kickedUserId: 'target-user-1' });
      expect(mockRemoveParticipant).toHaveBeenCalledWith('session-1', 'target-user-1');
      expect(mockSetSessionDjState).toHaveBeenCalledWith('session-1', expect.objectContaining({
        participantCount: 4,
      }));
    });

    it('rejects non-host callers', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      mockFindById.mockResolvedValue(session);

      const { kickPlayer } = await import('../../src/services/session-manager.js');
      await expect(kickPlayer('session-1', 'not-host', 'target-user-1')).rejects.toThrow();
    });

    it('rejects kicking yourself', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      mockFindById.mockResolvedValue(session);

      const { kickPlayer } = await import('../../src/services/session-manager.js');
      await expect(kickPlayer('session-1', 'host-user-1', 'host-user-1')).rejects.toThrow();
    });
  });

  describe('pauseSession', () => {
    it('pauses session, stores remaining timer, persists, and broadcasts', async () => {
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'song' as const,
        isPaused: false,
      });

      mockGetSessionDjState.mockReturnValue(context);
      mockPauseSessionTimer.mockReturnValue(15000);
      mockUpdateDjState.mockResolvedValue(undefined);

      const { pauseSession } = await import('../../src/services/session-manager.js');
      const result = await pauseSession('session-1');

      expect(result.isPaused).toBe(true);
      expect(result.pausedFromState).toBe('song');
      expect(result.timerRemainingMs).toBe(15000);
      expect(result.pausedAt).toEqual(expect.any(Number));

      expect(mockSetSessionDjState).toHaveBeenCalledWith('session-1', expect.objectContaining({
        isPaused: true,
        pausedFromState: 'song',
        timerRemainingMs: 15000,
      }));
      expect(mockBroadcastDjPause).toHaveBeenCalledWith('session-1', expect.objectContaining({
        isPaused: true,
      }));
    });

    it('stores null timerRemainingMs when no timer was active', async () => {
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'song' as const,
        isPaused: false,
      });

      mockGetSessionDjState.mockReturnValue(context);
      mockPauseSessionTimer.mockReturnValue(null);
      mockUpdateDjState.mockResolvedValue(undefined);

      const { pauseSession } = await import('../../src/services/session-manager.js');
      const result = await pauseSession('session-1');

      expect(result.timerRemainingMs).toBeNull();
    });

    it('rejects if already paused', async () => {
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'song' as const,
        isPaused: true,
      });

      mockGetSessionDjState.mockReturnValue(context);

      const { pauseSession } = await import('../../src/services/session-manager.js');
      await expect(pauseSession('session-1')).rejects.toMatchObject({
        code: 'ALREADY_PAUSED',
      });
    });

    it('rejects if in lobby', async () => {
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'lobby' as const,
      });

      mockGetSessionDjState.mockReturnValue(context);

      const { pauseSession } = await import('../../src/services/session-manager.js');
      await expect(pauseSession('session-1')).rejects.toMatchObject({
        code: 'INVALID_STATE',
      });
    });

    it('rejects if in finale', async () => {
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'finale' as const,
      });

      mockGetSessionDjState.mockReturnValue(context);

      const { pauseSession } = await import('../../src/services/session-manager.js');
      await expect(pauseSession('session-1')).rejects.toMatchObject({
        code: 'INVALID_STATE',
      });
    });

    it('rejects if no DJ state exists', async () => {
      mockGetSessionDjState.mockReturnValue(undefined);

      const { pauseSession } = await import('../../src/services/session-manager.js');
      await expect(pauseSession('nonexistent')).rejects.toMatchObject({
        code: 'SESSION_NOT_FOUND',
      });
    });
  });

  describe('resumeSession', () => {
    it('resumes session, reschedules timer, clears pause state, persists, broadcasts', async () => {
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'song' as const,
        isPaused: true,
        pausedAt: 1000,
        pausedFromState: 'song' as const,
        timerRemainingMs: 15000,
      });

      mockGetSessionDjState.mockReturnValue(context);
      mockUpdateDjState.mockResolvedValue(undefined);

      const { resumeSession } = await import('../../src/services/session-manager.js');
      const result = await resumeSession('session-1');

      expect(result.isPaused).toBe(false);
      expect(result.pausedAt).toBeNull();
      expect(result.pausedFromState).toBeNull();
      expect(result.timerRemainingMs).toBeNull();
      expect(result.timerStartedAt).toEqual(expect.any(Number));
      expect(result.timerDurationMs).toBe(15000);

      expect(mockResumeSessionTimer).toHaveBeenCalledWith(
        'session-1',
        15000,
        expect.any(Function),
      );
      expect(mockBroadcastDjResume).toHaveBeenCalledWith('session-1', expect.objectContaining({
        isPaused: false,
      }));
    });

    it('does not schedule timer if timerRemainingMs is null', async () => {
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'song' as const,
        isPaused: true,
        pausedAt: 1000,
        pausedFromState: 'song' as const,
        timerRemainingMs: null,
      });

      mockGetSessionDjState.mockReturnValue(context);
      mockUpdateDjState.mockResolvedValue(undefined);

      const { resumeSession } = await import('../../src/services/session-manager.js');
      await resumeSession('session-1');

      expect(mockResumeSessionTimer).not.toHaveBeenCalled();
    });

    it('rejects if not paused', async () => {
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'song' as const,
        isPaused: false,
      });

      mockGetSessionDjState.mockReturnValue(context);

      const { resumeSession } = await import('../../src/services/session-manager.js');
      await expect(resumeSession('session-1')).rejects.toMatchObject({
        code: 'NOT_PAUSED',
      });
    });

    it('rejects if no DJ state exists', async () => {
      mockGetSessionDjState.mockReturnValue(undefined);

      const { resumeSession } = await import('../../src/services/session-manager.js');
      await expect(resumeSession('nonexistent')).rejects.toMatchObject({
        code: 'SESSION_NOT_FOUND',
      });
    });
  });

  describe('endSession while paused', () => {
    it('clears isPaused before transitioning to finale', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'song' as const,
        isPaused: true,
        pausedAt: 1000,
        pausedFromState: 'song' as const,
        timerRemainingMs: 15000,
      });
      const finaleContext = createTestDJContext({ sessionId: 'session-1', state: 'finale' as const });

      mockFindById.mockResolvedValue(session);
      mockGetSessionDjState.mockReturnValue(context);
      mockProcessTransition.mockReturnValue({
        newContext: finaleContext,
        sideEffects: [
          { type: 'cancelTimer', data: {} },
          { type: 'broadcast', data: { from: 'song', to: 'finale' } },
          { type: 'persist', data: { context: { state: 'finale' } } },
        ],
      });
      mockUpdateStatus.mockResolvedValue(undefined);
      mockFlushEventStream.mockReturnValue([]);

      const { endSession } = await import('../../src/services/session-manager.js');
      await endSession('session-1', 'host-user-1');

      // Verify processTransition was called with isPaused: false
      expect(mockProcessTransition).toHaveBeenCalledWith(
        expect.objectContaining({
          isPaused: false,
          pausedAt: null,
          pausedFromState: null,
          timerRemainingMs: null,
        }),
        { type: 'END_PARTY' },
        expect.any(Number),
      );
    });
  });

  describe('event stream logging', () => {
    it('processDjTransition appends dj:stateChanged event', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      const newContext = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });

      mockProcessTransition.mockReturnValue({ newContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_SELECTED' }, 'user-1');

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'dj:stateChanged',
        userId: 'user-1',
        data: { from: 'songSelection', to: 'song', trigger: 'SONG_SELECTED' },
      }));
    });

    it('processDjTransition passes undefined userId for TIMEOUT', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });
      const newContext = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });

      mockProcessTransition.mockReturnValue({ newContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'TIMEOUT' });

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'dj:stateChanged',
        userId: undefined,
        data: expect.objectContaining({ trigger: 'TIMEOUT' }),
      }));
    });

    it('endSession appends party:ended event AND flushes to DB', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const, songCount: 5, sessionStartedAt: 1000 });
      const finaleContext = createTestDJContext({ sessionId: 'session-1', state: 'finale' as const });

      mockFindById.mockResolvedValue(session);
      mockGetSessionDjState.mockReturnValue(context);
      mockProcessTransition.mockReturnValue({
        newContext: finaleContext,
        sideEffects: [],
      });
      mockUpdateStatus.mockResolvedValue(undefined);
      const fakeEvents = [{ type: 'party:started', ts: 1000 }];
      mockFlushEventStream.mockReturnValue(fakeEvents);
      mockWriteEventStream.mockResolvedValue(undefined);

      const { endSession } = await import('../../src/services/session-manager.js');
      await endSession('session-1', 'host-user-1');

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'party:ended',
        userId: 'host-user-1',
        data: expect.objectContaining({ songCount: 5 }),
      }));
      expect(mockFlushEventStream).toHaveBeenCalledWith('session-1');
      expect(mockWriteEventStream).toHaveBeenCalledWith('session-1', fakeEvents);
    });

    it('pauseSession appends dj:pause event', async () => {
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'song' as const,
        isPaused: false,
      });

      mockGetSessionDjState.mockReturnValue(context);
      mockPauseSessionTimer.mockReturnValue(15000);
      mockUpdateDjState.mockResolvedValue(undefined);

      const { pauseSession } = await import('../../src/services/session-manager.js');
      await pauseSession('session-1', 'user-1');

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'dj:pause',
        userId: 'user-1',
        data: { fromState: 'song' },
      }));
    });

    it('resumeSession appends dj:resume event', async () => {
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'song' as const,
        isPaused: true,
        pausedAt: 1000,
        pausedFromState: 'song' as const,
        timerRemainingMs: 15000,
      });

      mockGetSessionDjState.mockReturnValue(context);
      mockUpdateDjState.mockResolvedValue(undefined);

      const { resumeSession } = await import('../../src/services/session-manager.js');
      await resumeSession('session-1', 'user-1');

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'dj:resume',
        userId: 'user-1',
        data: expect.objectContaining({ toState: 'song' }),
      }));
    });

    it('kickPlayer appends party:kicked event', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      const context = createTestDJContext({ sessionId: 'session-1', participantCount: 5 });

      mockFindById.mockResolvedValue(session);
      mockRemoveParticipant.mockResolvedValue(undefined);
      mockGetSessionDjState.mockReturnValue(context);
      mockUpdateDjState.mockResolvedValue(undefined);

      const { kickPlayer } = await import('../../src/services/session-manager.js');
      await kickPlayer('session-1', 'host-user-1', 'target-user-1');

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'party:kicked',
        userId: 'host-user-1',
        data: { kickedUserId: 'target-user-1' },
      }));
    });
  });

  describe('ceremony:typeSelected event logging', () => {
    it('processDjTransition to ceremony state appends ceremony:typeSelected event', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: DJState.song, songCount: 1 });
      const newContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
        songCount: 2,
        metadata: { ceremonyType: 'full', lastCeremonyType: 'full' },
      });

      mockProcessTransition.mockReturnValue({ newContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_ENDED' });

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'ceremony:typeSelected',
        data: expect.objectContaining({
          ceremonyType: 'full',
          songCount: 2,
        }),
      }));
    });

    it('event data includes correct participantCount', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: DJState.song, participantCount: 5 });
      const newContext = createTestDJContext({
        sessionId: 'session-1',
        state: DJState.ceremony,
        participantCount: 5,
        metadata: { ceremonyType: 'quick', lastCeremonyType: 'quick' },
      });

      mockProcessTransition.mockReturnValue({ newContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_ENDED' });

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'ceremony:typeSelected',
        data: expect.objectContaining({
          participantCount: 5,
        }),
      }));
    });

    it('does not append ceremony:typeSelected for non-ceremony transitions', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: DJState.songSelection });
      const newContext = createTestDJContext({ sessionId: 'session-1', state: DJState.song });

      mockProcessTransition.mockReturnValue({ newContext, sideEffects: [] });

      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', context, { type: 'SONG_SELECTED' });

      const ceremonyEvents = mockAppendEvent.mock.calls.filter(
        (call: unknown[]) => (call[1] as { type: string }).type === 'ceremony:typeSelected',
      );
      expect(ceremonyEvents).toHaveLength(0);
    });
  });

});
