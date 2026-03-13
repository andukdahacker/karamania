import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

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

const mockGetAllActiveSessions = vi.fn();
vi.mock('../../src/services/dj-state-store.js', () => ({
  getAllActiveSessions: (...args: unknown[]) => mockGetAllActiveSessions(...args),
  getSessionDjState: vi.fn(),
  setSessionDjState: vi.fn(),
  removeSessionDjState: vi.fn(),
}));

const mockGetLastActivity = vi.fn();
vi.mock('../../src/services/activity-tracker.js', () => ({
  getLastActivity: (...args: unknown[]) => mockGetLastActivity(...args),
  recordActivity: vi.fn(),
  removeSession: vi.fn(),
  clearAll: vi.fn(),
}));

const mockPauseSession = vi.fn();
vi.mock('../../src/services/session-manager.js', () => ({
  pauseSession: (...args: unknown[]) => mockPauseSession(...args),
  processDjTransition: vi.fn(),
  persistDjState: vi.fn(),
}));

vi.mock('../../src/persistence/session-repository.js', () => ({
  findById: vi.fn(),
  updateDjState: vi.fn(),
}));

vi.mock('../../src/services/timer-scheduler.js', () => ({
  scheduleSessionTimer: vi.fn(),
  cancelSessionTimer: vi.fn(),
  pauseSessionTimer: vi.fn(),
  resumeSessionTimer: vi.fn(),
}));

vi.mock('../../src/services/dj-broadcaster.js', () => ({
  broadcastDjState: vi.fn(),
  broadcastDjPause: vi.fn(),
  broadcastDjResume: vi.fn(),
  broadcastCeremonyAnticipation: vi.fn(),
  broadcastCeremonyReveal: vi.fn(),
  broadcastCeremonyQuick: vi.fn(),
}));

vi.mock('../../src/services/connection-tracker.js', () => ({
  removeSession: vi.fn(),
}));

vi.mock('../../src/services/party-code.js', () => ({
  generateUniquePartyCode: vi.fn(),
}));

import { createTestDJContext } from '../factories/dj-state.js';

describe('inactivity-monitor', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('auto-pauses session after 90s of inactivity', async () => {
    const now = Date.now();
    const context = createTestDJContext({
      sessionId: 'session-1',
      state: 'song' as const,
      isPaused: false,
    });

    mockGetAllActiveSessions.mockReturnValue([{ sessionId: 'session-1', context }]);
    mockGetLastActivity.mockReturnValue(now - 91_000); // 91s ago
    mockPauseSession.mockResolvedValue(undefined);

    const { startInactivityMonitor, stopInactivityMonitor, CHECK_INTERVAL_MS } = await import('../../src/services/inactivity-monitor.js');
    startInactivityMonitor();

    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);

    expect(mockPauseSession).toHaveBeenCalledWith('session-1');

    stopInactivityMonitor();
  });

  it('does not pause active sessions', async () => {
    const now = Date.now();
    const context = createTestDJContext({
      sessionId: 'session-1',
      state: 'song' as const,
      isPaused: false,
    });

    mockGetAllActiveSessions.mockReturnValue([{ sessionId: 'session-1', context }]);
    mockGetLastActivity.mockReturnValue(now - 30_000); // 30s ago — active

    const { startInactivityMonitor, stopInactivityMonitor, CHECK_INTERVAL_MS } = await import('../../src/services/inactivity-monitor.js');
    startInactivityMonitor();

    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);

    expect(mockPauseSession).not.toHaveBeenCalled();

    stopInactivityMonitor();
  });

  it('does not re-pause already paused sessions', async () => {
    const now = Date.now();
    const context = createTestDJContext({
      sessionId: 'session-1',
      state: 'song' as const,
      isPaused: true,
    });

    mockGetAllActiveSessions.mockReturnValue([{ sessionId: 'session-1', context }]);
    mockGetLastActivity.mockReturnValue(now - 200_000);

    const { startInactivityMonitor, stopInactivityMonitor, CHECK_INTERVAL_MS } = await import('../../src/services/inactivity-monitor.js');
    startInactivityMonitor();

    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);

    expect(mockPauseSession).not.toHaveBeenCalled();

    stopInactivityMonitor();
  });

  it('skips lobby sessions', async () => {
    const now = Date.now();
    const context = createTestDJContext({
      sessionId: 'session-1',
      state: 'lobby' as const,
      isPaused: false,
    });

    mockGetAllActiveSessions.mockReturnValue([{ sessionId: 'session-1', context }]);
    mockGetLastActivity.mockReturnValue(now - 200_000);

    const { startInactivityMonitor, stopInactivityMonitor, CHECK_INTERVAL_MS } = await import('../../src/services/inactivity-monitor.js');
    startInactivityMonitor();

    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);

    expect(mockPauseSession).not.toHaveBeenCalled();

    stopInactivityMonitor();
  });

  it('skips finale sessions', async () => {
    const now = Date.now();
    const context = createTestDJContext({
      sessionId: 'session-1',
      state: 'finale' as const,
      isPaused: false,
    });

    mockGetAllActiveSessions.mockReturnValue([{ sessionId: 'session-1', context }]);
    mockGetLastActivity.mockReturnValue(now - 200_000);

    const { startInactivityMonitor, stopInactivityMonitor, CHECK_INTERVAL_MS } = await import('../../src/services/inactivity-monitor.js');
    startInactivityMonitor();

    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);

    expect(mockPauseSession).not.toHaveBeenCalled();

    stopInactivityMonitor();
  });

  it('skips sessions with no recorded activity', async () => {
    const context = createTestDJContext({
      sessionId: 'session-1',
      state: 'song' as const,
      isPaused: false,
    });

    mockGetAllActiveSessions.mockReturnValue([{ sessionId: 'session-1', context }]);
    mockGetLastActivity.mockReturnValue(undefined);

    const { startInactivityMonitor, stopInactivityMonitor, CHECK_INTERVAL_MS } = await import('../../src/services/inactivity-monitor.js');
    startInactivityMonitor();

    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);

    expect(mockPauseSession).not.toHaveBeenCalled();

    stopInactivityMonitor();
  });

  it('handles pauseSession errors gracefully during auto-pause', async () => {
    const now = Date.now();
    const context = createTestDJContext({
      sessionId: 'session-1',
      state: 'song' as const,
      isPaused: false,
    });

    mockGetAllActiveSessions.mockReturnValue([{ sessionId: 'session-1', context }]);
    mockGetLastActivity.mockReturnValue(now - 91_000);
    mockPauseSession.mockRejectedValue(new Error('Session already ended'));

    const { startInactivityMonitor, stopInactivityMonitor, CHECK_INTERVAL_MS } = await import('../../src/services/inactivity-monitor.js');
    startInactivityMonitor();

    // Should not throw — error is caught internally
    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS);

    expect(mockPauseSession).toHaveBeenCalledWith('session-1');

    stopInactivityMonitor();
  });

  it('stopInactivityMonitor prevents further checks', async () => {
    const now = Date.now();
    const context = createTestDJContext({
      sessionId: 'session-1',
      state: 'song' as const,
      isPaused: false,
    });

    mockGetAllActiveSessions.mockReturnValue([{ sessionId: 'session-1', context }]);
    mockGetLastActivity.mockReturnValue(now - 91_000);
    mockPauseSession.mockResolvedValue(undefined);

    const { startInactivityMonitor, stopInactivityMonitor, CHECK_INTERVAL_MS } = await import('../../src/services/inactivity-monitor.js');
    startInactivityMonitor();
    stopInactivityMonitor();

    await vi.advanceTimersByTimeAsync(CHECK_INTERVAL_MS * 3);

    expect(mockPauseSession).not.toHaveBeenCalled();
  });
});
