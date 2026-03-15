import { describe, it, expect, vi, beforeEach } from 'vitest';
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

const mockGetSessionDjState = vi.fn();
vi.mock('../../src/services/dj-state-store.js', () => ({
  getSessionDjState: (...args: unknown[]) => mockGetSessionDjState(...args),
  setSessionDjState: vi.fn(),
  removeSessionDjState: vi.fn(),
}));

const mockRecordUserEvent = vi.fn();
const mockCheckRateLimit = vi.fn();
vi.mock('../../src/services/rate-limiter.js', () => ({
  recordUserEvent: (...args: unknown[]) => mockRecordUserEvent(...args),
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  cleanupStaleTimestamps: vi.fn(),
  clearRateLimitStore: vi.fn(),
}));

const mockRecordParticipationAction = vi.fn();
vi.mock('../../src/services/session-manager.js', () => ({
  recordParticipationAction: (...args: unknown[]) => mockRecordParticipationAction(...args),
  persistDjState: vi.fn(),
}));

const mockRecordActivity = vi.fn();
vi.mock('../../src/services/activity-tracker.js', () => ({
  recordActivity: (...args: unknown[]) => mockRecordActivity(...args),
  removeSession: vi.fn(),
  clearAll: vi.fn(),
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

const mockAppendEvent = vi.fn();
vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

function createMockSocket(overrides: Partial<{ userId: string; sessionId: string; displayName: string }> = {}) {
  const handlers = new Map<string, (data?: unknown) => Promise<void>>();
  const emittedToSelf: Array<{ event: string; data: unknown }> = [];

  return {
    socket: {
      data: {
        userId: overrides.userId ?? 'user-1',
        sessionId: overrides.sessionId ?? 'session-1',
        role: 'authenticated' as const,
        displayName: overrides.displayName ?? 'Test User',
      },
      on: (event: string, handler: (data?: unknown) => Promise<void>) => {
        handlers.set(event, handler);
      },
      emit: (event: string, data: unknown) => {
        emittedToSelf.push({ event, data });
      },
      to: (target: string) => ({
        emit: vi.fn(),
      }),
    },
    handlers,
    emittedToSelf,
  };
}

function createMockIo() {
  return {
    io: {
      to: (target: string) => ({
        emit: vi.fn(),
      }),
    },
  };
}

describe('lightstick-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupSongState() {
    const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });
    mockGetSessionDjState.mockReturnValue(context);
    mockRecordUserEvent.mockReturnValue([Date.now()]);
    mockCheckRateLimit.mockReturnValue({ allowed: true, rewardMultiplier: 1.0 });
    mockRecordParticipationAction.mockResolvedValue(undefined);
  }

  describe('lightstick:toggled handler', () => {
    it('records participation action with passive scoring when active=true', async () => {
      setupSongState();

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerLightstickHandlers } = await import('../../src/socket-handlers/lightstick-handlers.js');
      registerLightstickHandlers(socket as never, io as never);

      await handlers.get('lightstick:toggled')!({ active: true });

      expect(mockRecordParticipationAction).toHaveBeenCalledWith(
        'session-1',
        'user-1',
        'lightstick:toggled',
        1.0,
      );
    });

    it('does NOT record participation action when active=false', async () => {
      setupSongState();

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerLightstickHandlers } = await import('../../src/socket-handlers/lightstick-handlers.js');
      registerLightstickHandlers(socket as never, io as never);

      await handlers.get('lightstick:toggled')!({ active: false });

      expect(mockRecordParticipationAction).not.toHaveBeenCalled();
    });

    it('appends event to event stream with active flag', async () => {
      setupSongState();

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerLightstickHandlers } = await import('../../src/socket-handlers/lightstick-handlers.js');
      registerLightstickHandlers(socket as never, io as never);

      await handlers.get('lightstick:toggled')!({ active: true });

      expect(mockAppendEvent).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'lightstick:toggled',
          userId: 'user-1',
          data: { active: true },
        }),
      );
    });

    it('does NOT broadcast to other participants (private mode)', async () => {
      setupSongState();

      const { socket, handlers, emittedToSelf } = createMockSocket();
      const { io } = createMockIo();

      const { registerLightstickHandlers } = await import('../../src/socket-handlers/lightstick-handlers.js');
      registerLightstickHandlers(socket as never, io as never);

      await handlers.get('lightstick:toggled')!({ active: true });

      // No emissions to self either (no broadcast at all)
      expect(emittedToSelf).toHaveLength(0);
    });

    it('silently drops event when DJ state is lobby', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'lobby' as const });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerLightstickHandlers } = await import('../../src/socket-handlers/lightstick-handlers.js');
      registerLightstickHandlers(socket as never, io as never);

      await handlers.get('lightstick:toggled')!({ active: true });

      expect(mockRecordParticipationAction).not.toHaveBeenCalled();
      expect(mockAppendEvent).not.toHaveBeenCalled();
    });

    it('calls recordActivity with sessionId', async () => {
      setupSongState();

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerLightstickHandlers } = await import('../../src/socket-handlers/lightstick-handlers.js');
      registerLightstickHandlers(socket as never, io as never);

      await handlers.get('lightstick:toggled')!({ active: true });

      expect(mockRecordActivity).toHaveBeenCalledWith('session-1');
    });
  });

  describe('hype:fired handler', () => {
    it('records participation action with active scoring on first fire', async () => {
      setupSongState();

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerLightstickHandlers, lastHypeTime } = await import('../../src/socket-handlers/lightstick-handlers.js');
      lastHypeTime.clear();
      registerLightstickHandlers(socket as never, io as never);

      await handlers.get('hype:fired')!();

      expect(mockRecordParticipationAction).toHaveBeenCalledWith(
        'session-1',
        'user-1',
        'hype:fired',
        1.0,
      );
    });

    it('appends event to event stream', async () => {
      setupSongState();

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerLightstickHandlers, lastHypeTime } = await import('../../src/socket-handlers/lightstick-handlers.js');
      lastHypeTime.clear();
      registerLightstickHandlers(socket as never, io as never);

      await handlers.get('hype:fired')!();

      expect(mockAppendEvent).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'hype:fired',
          userId: 'user-1',
          data: {},
        }),
      );
    });

    it('returns hype:cooldown to sender when fired within 5s cooldown', async () => {
      setupSongState();

      const { socket, handlers, emittedToSelf } = createMockSocket();
      const { io } = createMockIo();

      const { registerLightstickHandlers, lastHypeTime } = await import('../../src/socket-handlers/lightstick-handlers.js');
      lastHypeTime.clear();
      registerLightstickHandlers(socket as never, io as never);

      // First fire — succeeds
      await handlers.get('hype:fired')!();
      expect(mockRecordParticipationAction).toHaveBeenCalledTimes(1);

      // Second fire immediately — should be blocked
      vi.clearAllMocks();
      setupSongState();
      await handlers.get('hype:fired')!();

      expect(mockRecordParticipationAction).not.toHaveBeenCalled();
      expect(emittedToSelf).toContainEqual(
        expect.objectContaining({
          event: 'hype:cooldown',
          data: expect.objectContaining({
            remainingMs: expect.any(Number),
          }),
        }),
      );
    });

    it('does NOT broadcast to other participants', async () => {
      setupSongState();

      const { socket, handlers, emittedToSelf } = createMockSocket();
      const { io } = createMockIo();

      const { registerLightstickHandlers, lastHypeTime } = await import('../../src/socket-handlers/lightstick-handlers.js');
      lastHypeTime.clear();
      registerLightstickHandlers(socket as never, io as never);

      await handlers.get('hype:fired')!();

      // No emissions to self (no broadcast at all for hype)
      expect(emittedToSelf).toHaveLength(0);
    });

    it('silently drops event when DJ state is lobby', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'lobby' as const });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerLightstickHandlers, lastHypeTime } = await import('../../src/socket-handlers/lightstick-handlers.js');
      lastHypeTime.clear();
      registerLightstickHandlers(socket as never, io as never);

      await handlers.get('hype:fired')!();

      expect(mockRecordParticipationAction).not.toHaveBeenCalled();
      expect(mockAppendEvent).not.toHaveBeenCalled();
    });

    it('cleans up lastHypeTime on disconnect', async () => {
      setupSongState();

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerLightstickHandlers, lastHypeTime } = await import('../../src/socket-handlers/lightstick-handlers.js');
      lastHypeTime.clear();
      registerLightstickHandlers(socket as never, io as never);

      // Fire hype to populate lastHypeTime (session-scoped key)
      await handlers.get('hype:fired')!();
      expect(lastHypeTime.has('session-1:user-1')).toBe(true);

      // Simulate disconnect
      const disconnectHandler = handlers.get('disconnect')!;
      await disconnectHandler();

      expect(lastHypeTime.has('session-1:user-1')).toBe(false);
    });
  });

  describe('input validation', () => {
    it('silently drops lightstick:toggled with non-boolean active field', async () => {
      setupSongState();

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerLightstickHandlers } = await import('../../src/socket-handlers/lightstick-handlers.js');
      registerLightstickHandlers(socket as never, io as never);

      await handlers.get('lightstick:toggled')!({ active: 'string' });

      expect(mockRecordParticipationAction).not.toHaveBeenCalled();
      expect(mockAppendEvent).not.toHaveBeenCalled();
      expect(mockRecordActivity).not.toHaveBeenCalled();
    });

    it('silently drops lightstick:toggled with undefined payload', async () => {
      setupSongState();

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerLightstickHandlers } = await import('../../src/socket-handlers/lightstick-handlers.js');
      registerLightstickHandlers(socket as never, io as never);

      await handlers.get('lightstick:toggled')!(undefined);

      expect(mockRecordParticipationAction).not.toHaveBeenCalled();
      expect(mockAppendEvent).not.toHaveBeenCalled();
    });
  });
});
