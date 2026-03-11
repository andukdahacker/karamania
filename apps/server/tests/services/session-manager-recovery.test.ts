import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestSession } from '../factories/session.js';
import { createTestDJContext, createTestDJContextInState } from '../factories/dj-state.js';
import { DJState } from '../../src/dj-engine/types.js';
import { serializeDJContext } from '../../src/dj-engine/serializer.js';

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

const mockFindActiveSessions = vi.fn();
const mockUpdateStatus = vi.fn();
const mockUpdateDjState = vi.fn();

vi.mock('../../src/persistence/session-repository.js', () => ({
  findActiveSessions: (...args: unknown[]) => mockFindActiveSessions(...args),
  updateStatus: (...args: unknown[]) => mockUpdateStatus(...args),
  updateDjState: (...args: unknown[]) => mockUpdateDjState(...args),
  findById: vi.fn(),
}));

// Mock the dj-state-store to track calls
const mockGetSessionDjState = vi.fn();
const mockSetSessionDjState = vi.fn();
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

vi.mock('../../src/services/dj-broadcaster.js', () => ({
  broadcastDjState: vi.fn(),
  broadcastDjPause: vi.fn(),
  broadcastDjResume: vi.fn(),
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

vi.mock('../../src/services/party-code.js', () => ({
  generateUniquePartyCode: vi.fn(),
}));

describe('session-manager recovery', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateStatus.mockResolvedValue(undefined);
    mockUpdateDjState.mockResolvedValue(undefined);
  });

  describe('recoverActiveSessions', () => {
    it('recovers session in mid-song state with active timer', async () => {
      const now = Date.now();
      const timerStartedAt = now - 60_000; // 60s ago
      const djContext = createTestDJContextInState(DJState.song, {
        sessionId: 'session-1',
        timerStartedAt,
        timerDurationMs: 180_000, // 3 min total
      });

      const session = createTestSession({
        id: 'session-1',
        status: 'active',
        dj_state: serializeDJContext(djContext),
      });
      mockFindActiveSessions.mockResolvedValue([session]);

      const { recoverActiveSessions } = await import('../../src/services/session-manager.js');
      const result = await recoverActiveSessions(now);

      expect(result.recovered).toContain('session-1');
      expect(result.failed).toHaveLength(0);
      expect(mockSetSessionDjState).toHaveBeenCalledWith('session-1', expect.objectContaining({
        state: DJState.song,
        sessionId: 'session-1',
      }));
      // Timer should be rescheduled with remaining ~120s
      expect(mockScheduleSessionTimer).toHaveBeenCalledWith(
        'session-1',
        120_000,
        expect.any(Function),
      );
    });

    it('triggers TIMEOUT for expired timer during downtime', async () => {
      const now = Date.now();
      const timerStartedAt = now - 200_000; // 200s ago, well past 180s song duration
      const djContext = createTestDJContextInState(DJState.song, {
        sessionId: 'session-2',
        timerStartedAt,
        timerDurationMs: 180_000,
        songCount: 1,
      });

      const session = createTestSession({
        id: 'session-2',
        status: 'active',
        dj_state: serializeDJContext(djContext),
      });
      mockFindActiveSessions.mockResolvedValue([session]);

      const { recoverActiveSessions } = await import('../../src/services/session-manager.js');
      const result = await recoverActiveSessions(now);

      expect(result.recovered).toContain('session-2');
      // State should have advanced past song via TIMEOUT
      expect(mockSetSessionDjState).toHaveBeenCalledWith('session-2', expect.objectContaining({
        sessionId: 'session-2',
      }));
    });

    it('recovers paused state with no timer to reconcile', async () => {
      const now = Date.now();
      const djContext = createTestDJContextInState(DJState.song, {
        sessionId: 'session-3',
        timerStartedAt: null,
        timerDurationMs: null,
      });

      const session = createTestSession({
        id: 'session-3',
        status: 'active',
        dj_state: serializeDJContext(djContext),
      });
      mockFindActiveSessions.mockResolvedValue([session]);

      const { recoverActiveSessions } = await import('../../src/services/session-manager.js');
      const result = await recoverActiveSessions(now);

      expect(result.recovered).toContain('session-3');
      expect(mockScheduleSessionTimer).not.toHaveBeenCalled();
    });

    it('skips lobby state sessions with null dj_state', async () => {
      const session = createTestSession({
        id: 'session-4',
        status: 'active',
        dj_state: null,
      });
      mockFindActiveSessions.mockResolvedValue([session]);

      const { recoverActiveSessions } = await import('../../src/services/session-manager.js');
      const result = await recoverActiveSessions(Date.now());

      expect(result.recovered).toHaveLength(0);
      expect(result.failed).toHaveLength(0);
      expect(mockSetSessionDjState).not.toHaveBeenCalled();
    });

    it('gracefully ends session with corrupted DJ state', async () => {
      const session = createTestSession({
        id: 'session-5',
        status: 'active',
        dj_state: { invalid: 'garbage', not: 'a valid context' },
      });
      mockFindActiveSessions.mockResolvedValue([session]);

      const { recoverActiveSessions } = await import('../../src/services/session-manager.js');
      const result = await recoverActiveSessions(Date.now());

      expect(result.recovered).toHaveLength(0);
      expect(result.failed).toContain('session-5');
      expect(mockUpdateStatus).toHaveBeenCalledWith('session-5', 'ended');
    });

    it('handles mix of successful and failed recoveries', async () => {
      const now = Date.now();
      const validContext = createTestDJContextInState(DJState.songSelection, {
        sessionId: 'session-ok',
        timerStartedAt: now - 5000,
        timerDurationMs: 30_000,
      });

      const sessions = [
        createTestSession({
          id: 'session-ok',
          status: 'active',
          dj_state: serializeDJContext(validContext),
        }),
        createTestSession({
          id: 'session-bad',
          status: 'active',
          dj_state: 'not-valid-json-object',
        }),
      ];
      mockFindActiveSessions.mockResolvedValue(sessions);

      const { recoverActiveSessions } = await import('../../src/services/session-manager.js');
      const result = await recoverActiveSessions(now);

      expect(result.recovered).toContain('session-ok');
      expect(result.failed).toContain('session-bad');
    });

    it('returns empty arrays when no active sessions exist', async () => {
      mockFindActiveSessions.mockResolvedValue([]);

      const { recoverActiveSessions } = await import('../../src/services/session-manager.js');
      const result = await recoverActiveSessions(Date.now());

      expect(result.recovered).toEqual([]);
      expect(result.failed).toEqual([]);
    });

    it('recovers session in ceremony state', async () => {
      const now = Date.now();
      const djContext = createTestDJContextInState(DJState.ceremony, {
        sessionId: 'session-ceremony',
        timerStartedAt: now - 3000,
        timerDurationMs: 10_000,
      });

      const session = createTestSession({
        id: 'session-ceremony',
        status: 'active',
        dj_state: serializeDJContext(djContext),
      });
      mockFindActiveSessions.mockResolvedValue([session]);

      const { recoverActiveSessions } = await import('../../src/services/session-manager.js');
      const result = await recoverActiveSessions(now);

      expect(result.recovered).toContain('session-ceremony');
      expect(mockScheduleSessionTimer).toHaveBeenCalledWith(
        'session-ceremony',
        7_000,
        expect.any(Function),
      );
    });

    it('recovers session in interlude state', async () => {
      const now = Date.now();
      const djContext = createTestDJContextInState(DJState.interlude, {
        sessionId: 'session-interlude',
        timerStartedAt: now - 5000,
        timerDurationMs: 15_000,
      });

      const session = createTestSession({
        id: 'session-interlude',
        status: 'active',
        dj_state: serializeDJContext(djContext),
      });
      mockFindActiveSessions.mockResolvedValue([session]);

      const { recoverActiveSessions } = await import('../../src/services/session-manager.js');
      const result = await recoverActiveSessions(now);

      expect(result.recovered).toContain('session-interlude');
      expect(mockScheduleSessionTimer).toHaveBeenCalledWith(
        'session-interlude',
        10_000,
        expect.any(Function),
      );
    });
    it('sets session status to ended on failed recovery', async () => {
      const session = createTestSession({
        id: 'session-fail',
        status: 'active',
        dj_state: { state: 999, garbage: true },
      });
      mockFindActiveSessions.mockResolvedValue([session]);

      const { recoverActiveSessions } = await import('../../src/services/session-manager.js');
      const result = await recoverActiveSessions(Date.now());

      expect(result.failed).toContain('session-fail');
      expect(mockUpdateStatus).toHaveBeenCalledWith('session-fail', 'ended');
      expect(mockSetSessionDjState).not.toHaveBeenCalled();
    });

    it('expired timer triggers TIMEOUT and new state gets timer scheduled', async () => {
      // songSelection timeout → advances to next state in cycle
      // processTransition sets timerStartedAt = now, so new state has fresh timer
      const now = Date.now();
      const djContext = createTestDJContextInState(DJState.songSelection, {
        sessionId: 'session-cascade',
        timerStartedAt: now - 60_000, // well past 30s songSelection timeout
        timerDurationMs: 30_000,
      });

      const session = createTestSession({
        id: 'session-cascade',
        status: 'active',
        dj_state: serializeDJContext(djContext),
      });
      mockFindActiveSessions.mockResolvedValue([session]);

      const { recoverActiveSessions } = await import('../../src/services/session-manager.js');
      const result = await recoverActiveSessions(now);

      expect(result.recovered).toContain('session-cascade');
      // State should have advanced from songSelection via TIMEOUT
      // The new state (partyCardDeal or song) should have a timer scheduled
      expect(mockSetSessionDjState).toHaveBeenCalledWith('session-cascade', expect.not.objectContaining({
        state: DJState.songSelection,
      }));
      // New state should have a timer scheduled (partyCardDeal or song both have timeouts)
      expect(mockScheduleSessionTimer).toHaveBeenCalledWith(
        'session-cascade',
        expect.any(Number),
        expect.any(Function),
      );
    });

    it('recovers paused session without scheduling timer', async () => {
      const now = Date.now();
      const djContext = createTestDJContextInState(DJState.song, {
        sessionId: 'session-paused',
        isPaused: true,
        pausedAt: now - 30_000,
        pausedFromState: DJState.song,
        timerRemainingMs: 15000,
        timerStartedAt: now - 60_000,
        timerDurationMs: 180_000,
      });

      const session = createTestSession({
        id: 'session-paused',
        status: 'active',
        dj_state: serializeDJContext(djContext),
      });
      mockFindActiveSessions.mockResolvedValue([session]);

      const logSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { recoverActiveSessions } = await import('../../src/services/session-manager.js');
      const result = await recoverActiveSessions(now);

      expect(result.recovered).toContain('session-paused');
      expect(result.failed).toHaveLength(0);
      expect(mockSetSessionDjState).toHaveBeenCalledWith('session-paused', expect.objectContaining({
        isPaused: true,
        pausedFromState: DJState.song,
        timerRemainingMs: 15000,
      }));
      // No timer should be scheduled for paused session
      expect(mockScheduleSessionTimer).not.toHaveBeenCalled();
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('recovered in paused state'),
      );
      logSpy.mockRestore();
    });

    it('recovers session in songSelection state with active timer', async () => {
      const now = Date.now();
      const djContext = createTestDJContextInState(DJState.songSelection, {
        sessionId: 'session-songsel',
        timerStartedAt: now - 10_000,
        timerDurationMs: 30_000,
      });

      const session = createTestSession({
        id: 'session-songsel',
        status: 'active',
        dj_state: serializeDJContext(djContext),
      });
      mockFindActiveSessions.mockResolvedValue([session]);

      const { recoverActiveSessions } = await import('../../src/services/session-manager.js');
      const result = await recoverActiveSessions(now);

      expect(result.recovered).toContain('session-songsel');
      expect(mockScheduleSessionTimer).toHaveBeenCalledWith(
        'session-songsel',
        20_000,
        expect.any(Function),
      );
    });
  });

  describe('isRecoveryFailed', () => {
    it('returns true for sessions that failed recovery', async () => {
      const session = createTestSession({
        id: 'session-failed',
        status: 'active',
        dj_state: { broken: true },
      });
      mockFindActiveSessions.mockResolvedValue([session]);

      const { recoverActiveSessions, isRecoveryFailed } = await import('../../src/services/session-manager.js');
      await recoverActiveSessions(Date.now());

      expect(isRecoveryFailed('session-failed')).toBe(true);
    });

    it('returns false for sessions that recovered successfully', async () => {
      const now = Date.now();
      const djContext = createTestDJContextInState(DJState.song, {
        sessionId: 'session-good',
        timerStartedAt: now - 5000,
        timerDurationMs: 180_000,
      });
      const session = createTestSession({
        id: 'session-good',
        status: 'active',
        dj_state: serializeDJContext(djContext),
      });
      mockFindActiveSessions.mockResolvedValue([session]);

      const { recoverActiveSessions, isRecoveryFailed } = await import('../../src/services/session-manager.js');
      await recoverActiveSessions(now);

      expect(isRecoveryFailed('session-good')).toBe(false);
    });

    it('returns false for unknown sessions', async () => {
      const { isRecoveryFailed } = await import('../../src/services/session-manager.js');
      expect(isRecoveryFailed('unknown')).toBe(false);
    });
  });
});
