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
const mockEmitCaptureBubble = vi.fn();
vi.mock('../../src/services/session-manager.js', () => ({
  recordParticipationAction: (...args: unknown[]) => mockRecordParticipationAction(...args),
  emitCaptureBubble: (...args: unknown[]) => mockEmitCaptureBubble(...args),
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

const mockRecordReactionStreak = vi.fn();
vi.mock('../../src/services/streak-tracker.js', () => ({
  recordReactionStreak: (...args: unknown[]) => mockRecordReactionStreak(...args),
  clearSessionStreaks: vi.fn(),
  clearUserStreak: vi.fn(),
  clearStreakStore: vi.fn(),
}));

const mockRecordReaction = vi.fn().mockReturnValue(false);
const mockResetLastPeak = vi.fn();
vi.mock('../../src/services/peak-detector.js', () => ({
  recordReaction: (...args: unknown[]) => mockRecordReaction(...args),
  resetLastPeak: (...args: unknown[]) => mockResetLastPeak(...args),
  clearSession: vi.fn(),
  clearAllSessions: vi.fn(),
}));

function createMockSocket(overrides: Partial<{ userId: string; sessionId: string; displayName: string }> = {}) {
  const handlers = new Map<string, (data?: unknown) => Promise<void>>();
  const emittedDirect: Array<{ event: string; data: unknown }> = [];

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
        emittedDirect.push({ event, data });
      },
    },
    handlers,
    emittedDirect,
  };
}

function createMockIo() {
  const emittedToRoom: Array<{ room: string; event: string; data: unknown }> = [];

  return {
    io: {
      to: (target: string) => ({
        emit: (event: string, data: unknown) => {
          emittedToRoom.push({ room: target, event, data });
        },
      }),
    },
    emittedToRoom,
  };
}

describe('reaction-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  function setupSongState() {
    const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });
    mockGetSessionDjState.mockReturnValue(context);
    mockRecordUserEvent.mockReturnValue([Date.now()]);
    mockCheckRateLimit.mockReturnValue({ allowed: true, rewardMultiplier: 1.0 });
    mockRecordReactionStreak.mockReturnValue({ streakCount: 1, milestone: null });
    mockRecordParticipationAction.mockResolvedValue(undefined);
  }

  describe('reaction:sent during DJState.song', () => {
    it('broadcasts reaction to session room via io.to(sessionId).emit()', async () => {
      setupSongState();

      const { socket, handlers } = createMockSocket();
      const { io, emittedToRoom } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: '🔥' });

      expect(emittedToRoom).toContainEqual({
        room: 'session-1',
        event: 'reaction:broadcast',
        data: {
          userId: 'user-1',
          emoji: '🔥',
          rewardMultiplier: 1.0,
        },
      });
    });

    it('includes userId, emoji, and rewardMultiplier in broadcast payload', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockRecordUserEvent.mockReturnValue([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      mockCheckRateLimit.mockReturnValue({ allowed: true, rewardMultiplier: 0.5 });
      mockRecordReactionStreak.mockReturnValue({ streakCount: 3, milestone: null });
      mockRecordParticipationAction.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io, emittedToRoom } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: '👏' });

      expect(emittedToRoom[0]!.data).toEqual({
        userId: 'user-1',
        emoji: '👏',
        rewardMultiplier: 0.5,
      });
    });

    it('calls recordParticipationAction with reaction:sent and correct multiplier', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockRecordUserEvent.mockReturnValue([Date.now()]);
      mockCheckRateLimit.mockReturnValue({ allowed: true, rewardMultiplier: 0.75 });
      mockRecordReactionStreak.mockReturnValue({ streakCount: 1, milestone: null });
      mockRecordParticipationAction.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: '🔥' });

      expect(mockRecordParticipationAction).toHaveBeenCalledWith(
        'session-1',
        'user-1',
        'reaction:sent',
        0.75,
      );
    });

    it('calls recordActivity with sessionId', async () => {
      setupSongState();

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: '🔥' });

      expect(mockRecordActivity).toHaveBeenCalledWith('session-1');
    });
  });

  describe('reaction:streak milestone emission', () => {
    it('emits reaction:streak via socket.emit() when milestone is reached', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockRecordUserEvent.mockReturnValue([Date.now()]);
      mockCheckRateLimit.mockReturnValue({ allowed: true, rewardMultiplier: 1.0 });
      mockRecordReactionStreak.mockReturnValue({ streakCount: 5, milestone: 5 });
      mockRecordParticipationAction.mockResolvedValue(undefined);

      const { socket, handlers, emittedDirect } = createMockSocket({ displayName: 'DJ Master' });
      const { io } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: '🔥' });

      expect(emittedDirect).toContainEqual({
        event: 'reaction:streak',
        data: {
          streakCount: 5,
          emoji: '🔥',
          displayName: 'DJ Master',
        },
      });
    });

    it('milestone payload contains streakCount, emoji, and displayName from socket.data', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockRecordUserEvent.mockReturnValue([Date.now()]);
      mockCheckRateLimit.mockReturnValue({ allowed: true, rewardMultiplier: 1.0 });
      mockRecordReactionStreak.mockReturnValue({ streakCount: 10, milestone: 10 });
      mockRecordParticipationAction.mockResolvedValue(undefined);

      const { socket, handlers, emittedDirect } = createMockSocket({ displayName: 'Minh' });
      const { io } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: '🎤' });

      const streakEmission = emittedDirect.find(e => e.event === 'reaction:streak');
      expect(streakEmission).toBeDefined();
      expect(streakEmission!.data).toEqual({
        streakCount: 10,
        emoji: '🎤',
        displayName: 'Minh',
      });
    });

    it('does NOT emit reaction:streak for non-milestone reactions', async () => {
      setupSongState();
      // Default mock returns milestone: null

      const { socket, handlers, emittedDirect } = createMockSocket();
      const { io } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: '🔥' });

      const streakEmission = emittedDirect.find(e => e.event === 'reaction:streak');
      expect(streakEmission).toBeUndefined();
    });

    it('records streak regardless of rewardMultiplier value (AC #5)', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockRecordUserEvent.mockReturnValue([Date.now()]);
      mockCheckRateLimit.mockReturnValue({ allowed: true, rewardMultiplier: 0.125 });
      mockRecordReactionStreak.mockReturnValue({ streakCount: 15, milestone: null });
      mockRecordParticipationAction.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: '🔥' });

      expect(mockRecordReactionStreak).toHaveBeenCalledWith(
        'session-1',
        'user-1',
        expect.any(Number),
      );
    });
  });

  describe('reaction:sent event stream logging', () => {
    it('appends reaction:sent event to event stream with emoji and streak count', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockRecordUserEvent.mockReturnValue([Date.now()]);
      mockCheckRateLimit.mockReturnValue({ allowed: true, rewardMultiplier: 1.0 });
      mockRecordReactionStreak.mockReturnValue({ streakCount: 7, milestone: null });
      mockRecordParticipationAction.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: '🎵' });

      expect(mockAppendEvent).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'reaction:sent',
          userId: 'user-1',
          data: { emoji: '🎵', streak: 7 },
        }),
      );
    });

    it('reaction:sent event is separate from participation:scored event', async () => {
      setupSongState();

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: '🔥' });

      // appendEvent is called for reaction:sent
      expect(mockAppendEvent).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({ type: 'reaction:sent' }),
      );
      // recordParticipationAction handles participation:scored separately
      expect(mockRecordParticipationAction).toHaveBeenCalled();
    });

    it('logs streak count on every reaction (not just milestones)', async () => {
      setupSongState();
      mockRecordReactionStreak.mockReturnValue({ streakCount: 3, milestone: null });

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: '🔥' });

      expect(mockAppendEvent).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'reaction:sent',
          data: { emoji: '🔥', streak: 3 },
        }),
      );
    });
  });

  describe('reaction:sent outside DJState.song', () => {
    it('silently drops reaction when DJ state is lobby', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'lobby' as const });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers } = createMockSocket();
      const { io, emittedToRoom } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: '🔥' });

      expect(emittedToRoom).toHaveLength(0);
      expect(mockRecordParticipationAction).not.toHaveBeenCalled();
    });

    it('silently drops reaction when DJ state is ceremony', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'ceremony' as const });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers } = createMockSocket();
      const { io, emittedToRoom } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: '🔥' });

      expect(emittedToRoom).toHaveLength(0);
      expect(mockRecordParticipationAction).not.toHaveBeenCalled();
    });
  });

  describe('peak detection triggering', () => {
    it('calls emitCaptureBubble when recordReaction returns true', async () => {
      setupSongState();
      mockRecordReaction.mockReturnValue(true);
      mockEmitCaptureBubble.mockReturnValue(true);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: '🔥' });

      expect(mockRecordReaction).toHaveBeenCalledWith('session-1', expect.any(Number));
      expect(mockEmitCaptureBubble).toHaveBeenCalledWith('session-1', 'reaction_peak', 'song');
      expect(mockResetLastPeak).not.toHaveBeenCalled();
    });

    it('resets peak cooldown when bubble is suppressed by capture-trigger', async () => {
      setupSongState();
      mockRecordReaction.mockReturnValue(true);
      mockEmitCaptureBubble.mockReturnValue(false);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: '🔥' });

      expect(mockEmitCaptureBubble).toHaveBeenCalledWith('session-1', 'reaction_peak', 'song');
      expect(mockResetLastPeak).toHaveBeenCalledWith('session-1');
    });

    it('does NOT call emitCaptureBubble when recordReaction returns false', async () => {
      setupSongState();
      mockRecordReaction.mockReturnValue(false);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: '🔥' });

      expect(mockRecordReaction).toHaveBeenCalled();
      expect(mockEmitCaptureBubble).not.toHaveBeenCalled();
    });

    it('does not call recordReaction or emitCaptureBubble during non-song state', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'lobby' as const });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: '🔥' });

      expect(mockRecordReaction).not.toHaveBeenCalled();
      expect(mockEmitCaptureBubble).not.toHaveBeenCalled();
    });
  });

  describe('reaction:sent with missing data', () => {
    it('returns silently when sessionId is missing', async () => {
      const { socket, handlers } = createMockSocket();
      // Override sessionId to empty
      socket.data.sessionId = '';
      const { io, emittedToRoom } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: '🔥' });

      expect(emittedToRoom).toHaveLength(0);
      expect(mockGetSessionDjState).not.toHaveBeenCalled();
    });

    it('returns silently when userId is missing', async () => {
      const { socket, handlers } = createMockSocket();
      socket.data.userId = '';
      const { io, emittedToRoom } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: '🔥' });

      expect(emittedToRoom).toHaveLength(0);
      expect(mockGetSessionDjState).not.toHaveBeenCalled();
    });

    it('returns silently when emoji is not a string', async () => {
      const { socket, handlers } = createMockSocket();
      const { io, emittedToRoom } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: 123 } as never);

      expect(emittedToRoom).toHaveLength(0);
      expect(mockGetSessionDjState).not.toHaveBeenCalled();
    });

    it('returns silently when data is undefined', async () => {
      const { socket, handlers } = createMockSocket();
      const { io, emittedToRoom } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!(undefined);

      expect(emittedToRoom).toHaveLength(0);
      expect(mockGetSessionDjState).not.toHaveBeenCalled();
    });

    it('returns silently when DJ state is undefined (no session)', async () => {
      mockGetSessionDjState.mockReturnValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io, emittedToRoom } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: '🔥' });

      expect(emittedToRoom).toHaveLength(0);
      expect(mockRecordParticipationAction).not.toHaveBeenCalled();
    });
  });
});
