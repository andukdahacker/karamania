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

vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: vi.fn(),
}));

function createMockSocket(overrides: Partial<{ userId: string; sessionId: string }> = {}) {
  const handlers = new Map<string, (data?: unknown) => Promise<void>>();

  return {
    socket: {
      data: {
        userId: overrides.userId ?? 'user-1',
        sessionId: overrides.sessionId ?? 'session-1',
        role: 'authenticated' as const,
        displayName: 'Test User',
      },
      on: (event: string, handler: (data?: unknown) => Promise<void>) => {
        handlers.set(event, handler);
      },
    },
    handlers,
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

  describe('reaction:sent during DJState.song', () => {
    it('broadcasts reaction to session room via io.to(sessionId).emit()', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockRecordUserEvent.mockReturnValue([Date.now()]);
      mockCheckRateLimit.mockReturnValue({ allowed: true, rewardMultiplier: 1.0 });
      mockRecordParticipationAction.mockResolvedValue(undefined);

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
      const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockRecordUserEvent.mockReturnValue([Date.now()]);
      mockCheckRateLimit.mockReturnValue({ allowed: true, rewardMultiplier: 1.0 });
      mockRecordParticipationAction.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerReactionHandlers } = await import('../../src/socket-handlers/reaction-handlers.js');
      registerReactionHandlers(socket as never, io as never);

      await handlers.get('reaction:sent')!({ emoji: '🔥' });

      expect(mockRecordActivity).toHaveBeenCalledWith('session-1');
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
