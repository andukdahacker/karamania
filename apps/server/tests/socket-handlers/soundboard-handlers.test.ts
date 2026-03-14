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
  const emittedToSocket: Array<{ room: string; event: string; data: unknown }> = [];

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
      to: (target: string) => ({
        emit: (event: string, data: unknown) => {
          emittedToSocket.push({ room: target, event, data });
        },
      }),
    },
    handlers,
    emittedToSocket,
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

describe('soundboard-handlers', () => {
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

  describe('sound:play during DJState.song', () => {
    it('broadcasts sound to session room via socket.to(sessionId).emit() excluding sender', async () => {
      setupSongState();

      const { socket, handlers, emittedToSocket } = createMockSocket();
      const { io } = createMockIo();

      const { registerSoundboardHandlers } = await import('../../src/socket-handlers/soundboard-handlers.js');
      registerSoundboardHandlers(socket as never, io as never);

      await handlers.get('sound:play')!({ soundId: 'sbAirHorn' });

      expect(emittedToSocket).toContainEqual({
        room: 'session-1',
        event: 'sound:play',
        data: {
          userId: 'user-1',
          soundId: 'sbAirHorn',
          rewardMultiplier: 1.0,
        },
      });
    });

    it('includes correct rewardMultiplier from rate limiter in broadcast (AC #2)', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockRecordUserEvent.mockReturnValue([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11]);
      mockCheckRateLimit.mockReturnValue({ allowed: true, rewardMultiplier: 0.5 });
      mockRecordParticipationAction.mockResolvedValue(undefined);

      const { socket, handlers, emittedToSocket } = createMockSocket();
      const { io } = createMockIo();

      const { registerSoundboardHandlers } = await import('../../src/socket-handlers/soundboard-handlers.js');
      registerSoundboardHandlers(socket as never, io as never);

      await handlers.get('sound:play')!({ soundId: 'sbDrumRoll' });

      expect(emittedToSocket[0]!.data).toEqual({
        userId: 'user-1',
        soundId: 'sbDrumRoll',
        rewardMultiplier: 0.5,
      });
    });

    it('calls recordParticipationAction with sound:play and rewardMultiplier (AC #3)', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockRecordUserEvent.mockReturnValue([Date.now()]);
      mockCheckRateLimit.mockReturnValue({ allowed: true, rewardMultiplier: 0.75 });
      mockRecordParticipationAction.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSoundboardHandlers } = await import('../../src/socket-handlers/soundboard-handlers.js');
      registerSoundboardHandlers(socket as never, io as never);

      await handlers.get('sound:play')!({ soundId: 'sbRimshot' });

      expect(mockRecordParticipationAction).toHaveBeenCalledWith(
        'session-1',
        'user-1',
        'sound:play',
        0.75,
      );
    });

    it('calls appendEvent with sound:play event data', async () => {
      setupSongState();

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSoundboardHandlers } = await import('../../src/socket-handlers/soundboard-handlers.js');
      registerSoundboardHandlers(socket as never, io as never);

      await handlers.get('sound:play')!({ soundId: 'sbCrowdCheer' });

      expect(mockAppendEvent).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'sound:play',
          userId: 'user-1',
          data: { soundId: 'sbCrowdCheer' },
        }),
      );
    });

    it('calls recordActivity with sessionId', async () => {
      setupSongState();

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSoundboardHandlers } = await import('../../src/socket-handlers/soundboard-handlers.js');
      registerSoundboardHandlers(socket as never, io as never);

      await handlers.get('sound:play')!({ soundId: 'sbAirHorn' });

      expect(mockRecordActivity).toHaveBeenCalledWith('session-1');
    });

    it('broadcast still fires when rate-limited — no hard block (AC #2)', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockRecordUserEvent.mockReturnValue(Array.from({ length: 20 }, (_, i) => i));
      mockCheckRateLimit.mockReturnValue({ allowed: true, rewardMultiplier: 0.0 });
      mockRecordParticipationAction.mockResolvedValue(undefined);

      const { socket, handlers, emittedToSocket } = createMockSocket();
      const { io } = createMockIo();

      const { registerSoundboardHandlers } = await import('../../src/socket-handlers/soundboard-handlers.js');
      registerSoundboardHandlers(socket as never, io as never);

      await handlers.get('sound:play')!({ soundId: 'sbWolfWhistle' });

      // Broadcast still fires even with 0 reward multiplier
      expect(emittedToSocket).toHaveLength(1);
      expect(emittedToSocket[0]!.data).toEqual({
        userId: 'user-1',
        soundId: 'sbWolfWhistle',
        rewardMultiplier: 0.0,
      });
    });
  });

  describe('sound:play outside DJState.song (AC #4)', () => {
    it('silently drops event when DJ state is lobby', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'lobby' as const });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers, emittedToSocket } = createMockSocket();
      const { io } = createMockIo();

      const { registerSoundboardHandlers } = await import('../../src/socket-handlers/soundboard-handlers.js');
      registerSoundboardHandlers(socket as never, io as never);

      await handlers.get('sound:play')!({ soundId: 'sbAirHorn' });

      expect(emittedToSocket).toHaveLength(0);
      expect(mockRecordParticipationAction).not.toHaveBeenCalled();
    });

    it('silently drops event when DJ state is ceremony', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'ceremony' as const });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers, emittedToSocket } = createMockSocket();
      const { io } = createMockIo();

      const { registerSoundboardHandlers } = await import('../../src/socket-handlers/soundboard-handlers.js');
      registerSoundboardHandlers(socket as never, io as never);

      await handlers.get('sound:play')!({ soundId: 'sbAirHorn' });

      expect(emittedToSocket).toHaveLength(0);
      expect(mockRecordParticipationAction).not.toHaveBeenCalled();
    });
  });

  describe('sound:play validation', () => {
    it('silently drops unknown soundId', async () => {
      setupSongState();

      const { socket, handlers, emittedToSocket } = createMockSocket();
      const { io } = createMockIo();

      const { registerSoundboardHandlers } = await import('../../src/socket-handlers/soundboard-handlers.js');
      registerSoundboardHandlers(socket as never, io as never);

      await handlers.get('sound:play')!({ soundId: 'invalidSound' });

      expect(emittedToSocket).toHaveLength(0);
      expect(mockRecordParticipationAction).not.toHaveBeenCalled();
    });

    it('silently drops non-string soundId', async () => {
      const { socket, handlers, emittedToSocket } = createMockSocket();
      const { io } = createMockIo();

      const { registerSoundboardHandlers } = await import('../../src/socket-handlers/soundboard-handlers.js');
      registerSoundboardHandlers(socket as never, io as never);

      await handlers.get('sound:play')!({ soundId: 123 } as never);

      expect(emittedToSocket).toHaveLength(0);
      expect(mockGetSessionDjState).not.toHaveBeenCalled();
    });

    it('returns silently when sessionId is missing', async () => {
      const { socket, handlers, emittedToSocket } = createMockSocket();
      socket.data.sessionId = '';
      const { io } = createMockIo();

      const { registerSoundboardHandlers } = await import('../../src/socket-handlers/soundboard-handlers.js');
      registerSoundboardHandlers(socket as never, io as never);

      await handlers.get('sound:play')!({ soundId: 'sbAirHorn' });

      expect(emittedToSocket).toHaveLength(0);
      expect(mockGetSessionDjState).not.toHaveBeenCalled();
    });

    it('returns silently when userId is missing', async () => {
      const { socket, handlers, emittedToSocket } = createMockSocket();
      socket.data.userId = '';
      const { io } = createMockIo();

      const { registerSoundboardHandlers } = await import('../../src/socket-handlers/soundboard-handlers.js');
      registerSoundboardHandlers(socket as never, io as never);

      await handlers.get('sound:play')!({ soundId: 'sbAirHorn' });

      expect(emittedToSocket).toHaveLength(0);
      expect(mockGetSessionDjState).not.toHaveBeenCalled();
    });

    it('returns silently when DJ state is undefined (no session)', async () => {
      mockGetSessionDjState.mockReturnValue(undefined);

      const { socket, handlers, emittedToSocket } = createMockSocket();
      const { io } = createMockIo();

      const { registerSoundboardHandlers } = await import('../../src/socket-handlers/soundboard-handlers.js');
      registerSoundboardHandlers(socket as never, io as never);

      await handlers.get('sound:play')!({ soundId: 'sbAirHorn' });

      expect(emittedToSocket).toHaveLength(0);
      expect(mockRecordParticipationAction).not.toHaveBeenCalled();
    });
  });
});
