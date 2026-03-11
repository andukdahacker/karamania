import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestSession } from '../factories/session.js';
import { createTestDJContext } from '../factories/dj-state.js';

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
vi.mock('../../src/persistence/session-repository.js', () => ({
  create: vi.fn(),
  addParticipant: vi.fn(),
  addParticipantIfNotExists: vi.fn(),
  getParticipants: mockGetParticipants,
  findById: mockFindById,
  updateStatus: mockUpdateStatus,
  updateHost: vi.fn(),
  updateDjState: mockUpdateDjState,
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
vi.mock('../../src/services/timer-scheduler.js', () => ({
  scheduleSessionTimer: (...args: unknown[]) => mockScheduleSessionTimer(...args),
  cancelSessionTimer: (...args: unknown[]) => mockCancelSessionTimer(...args),
}));

const mockBroadcastDjState = vi.fn();
vi.mock('../../src/services/dj-broadcaster.js', () => ({
  broadcastDjState: (...args: unknown[]) => mockBroadcastDjState(...args),
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
  });
});
