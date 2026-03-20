import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDJContext } from '../factories/dj-state.js';
import { createTestSession } from '../factories/session.js';

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

const mockFindById = vi.fn();
vi.mock('../../src/persistence/session-repository.js', () => ({
  findById: (...args: unknown[]) => mockFindById(...args),
}));

const mockGetSessionDjState = vi.fn();
vi.mock('../../src/services/dj-state-store.js', () => ({
  getSessionDjState: (...args: unknown[]) => mockGetSessionDjState(...args),
  setSessionDjState: vi.fn(),
  removeSessionDjState: vi.fn(),
}));

const mockProcessDjTransition = vi.fn();
const mockInitiateFinale = vi.fn();
const mockFinalizeSession = vi.fn();
const mockKickPlayer = vi.fn();
const mockPauseSession = vi.fn();
const mockResumeSession = vi.fn();
vi.mock('../../src/services/session-manager.js', () => ({
  processDjTransition: (...args: unknown[]) => mockProcessDjTransition(...args),
  initiateFinale: (...args: unknown[]) => mockInitiateFinale(...args),
  finalizeSession: (...args: unknown[]) => mockFinalizeSession(...args),
  kickPlayer: (...args: unknown[]) => mockKickPlayer(...args),
  pauseSession: (...args: unknown[]) => mockPauseSession(...args),
  resumeSession: (...args: unknown[]) => mockResumeSession(...args),
  persistDjState: vi.fn(),
}));

const mockGetActiveConnections = vi.fn();
vi.mock('../../src/services/connection-tracker.js', () => ({
  getActiveConnections: (...args: unknown[]) => mockGetActiveConnections(...args),
  removeSession: vi.fn(),
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

vi.mock('../../src/services/activity-tracker.js', () => ({
  recordActivity: vi.fn(),
  removeSession: vi.fn(),
  clearAll: vi.fn(),
}));

const mockIsValidOverrideTarget = vi.fn();
vi.mock('../../src/dj-engine/states.js', () => ({
  isValidOverrideTarget: (...args: unknown[]) => mockIsValidOverrideTarget(...args),
}));

const mockAppendEvent = vi.fn();
vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

function createMockSocket(overrides: Partial<{ userId: string; sessionId: string }> = {}) {
  const handlers = new Map<string, (data?: unknown) => Promise<void>>();
  const emittedToSelf: Array<{ event: string; data: unknown }> = [];
  const emittedToRoom: Array<{ event: string; data: unknown }> = [];

  return {
    socket: {
      data: {
        userId: overrides.userId ?? 'host-user-1',
        sessionId: overrides.sessionId ?? 'session-1',
        role: 'authenticated' as const,
        displayName: 'Host',
      },
      on: (event: string, handler: (data?: unknown) => Promise<void>) => {
        handlers.set(event, handler);
      },
      emit: (event: string, data: unknown) => {
        emittedToSelf.push({ event, data });
      },
      to: (_roomId: string) => ({
        emit: (event: string, data: unknown) => {
          emittedToRoom.push({ event, data });
        },
      }),
    },
    handlers,
    emittedToSelf,
    emittedToRoom,
  };
}

function createMockIo() {
  const emittedToRoom: Array<{ room: string; event: string; data: unknown }> = [];
  const emittedToSocket: Array<{ socketId: string; event: string; data: unknown }> = [];
  const disconnectedSockets: string[] = [];

  return {
    io: {
      to: (target: string) => ({
        emit: (event: string, data: unknown) => {
          // Could be room or socket id
          emittedToRoom.push({ room: target, event, data });
          emittedToSocket.push({ socketId: target, event, data });
        },
      }),
      sockets: {
        sockets: new Map<string, { disconnect: (force: boolean) => void }>([
          ['kicked-socket-id', {
            disconnect: (force: boolean) => {
              if (force) disconnectedSockets.push('kicked-socket-id');
            },
          }],
        ]),
      },
    },
    emittedToRoom,
    emittedToSocket,
    disconnectedSockets,
  };
}

describe('host-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('host:skip', () => {
    it('validates host and calls processDjTransition with HOST_SKIP', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });

      mockFindById.mockResolvedValue(session);
      mockGetSessionDjState.mockReturnValue(context);
      mockProcessDjTransition.mockResolvedValue({ newContext: context, sideEffects: [] });

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerHostHandlers } = await import('../../src/socket-handlers/host-handlers.js');
      registerHostHandlers(socket as never, io as never);

      await handlers.get('host:skip')!();

      expect(mockProcessDjTransition).toHaveBeenCalledWith('session-1', context, { type: 'HOST_SKIP' }, 'host-user-1');
    });

    it('rejects non-host users', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'other-user' });
      mockFindById.mockResolvedValue(session);

      const { socket, handlers, emittedToSelf } = createMockSocket();
      const { io } = createMockIo();

      const { registerHostHandlers } = await import('../../src/socket-handlers/host-handlers.js');
      registerHostHandlers(socket as never, io as never);

      await handlers.get('host:skip')!();

      expect(mockProcessDjTransition).not.toHaveBeenCalled();
      expect(emittedToSelf).toContainEqual({
        event: 'error',
        data: { code: 'NOT_HOST', message: 'Only the host can perform this action' },
      });
    });
  });

  describe('host:override', () => {
    it('validates host and calls processDjTransition with HOST_OVERRIDE', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });

      mockFindById.mockResolvedValue(session);
      mockIsValidOverrideTarget.mockReturnValue(true);
      mockGetSessionDjState.mockReturnValue(context);
      mockProcessDjTransition.mockResolvedValue({ newContext: context, sideEffects: [] });

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerHostHandlers } = await import('../../src/socket-handlers/host-handlers.js');
      registerHostHandlers(socket as never, io as never);

      await handlers.get('host:override')!({ targetState: 'ceremony' });

      expect(mockProcessDjTransition).toHaveBeenCalledWith('session-1', context, { type: 'HOST_OVERRIDE', targetState: 'ceremony' }, 'host-user-1');
    });

    it('rejects invalid override targets (lobby)', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      mockFindById.mockResolvedValue(session);
      mockIsValidOverrideTarget.mockReturnValue(false);

      const { socket, handlers, emittedToSelf } = createMockSocket();
      const { io } = createMockIo();

      const { registerHostHandlers } = await import('../../src/socket-handlers/host-handlers.js');
      registerHostHandlers(socket as never, io as never);

      await handlers.get('host:override')!({ targetState: 'lobby' });

      expect(mockProcessDjTransition).not.toHaveBeenCalled();
      expect(emittedToSelf).toContainEqual({
        event: 'error',
        data: { code: 'INVALID_OVERRIDE_TARGET', message: "Cannot override to 'lobby'" },
      });
    });
  });

  describe('host:songOver', () => {
    it('validates host, checks song state, and calls processDjTransition with SONG_ENDED', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });

      mockFindById.mockResolvedValue(session);
      mockGetSessionDjState.mockReturnValue(context);
      mockProcessDjTransition.mockResolvedValue({ newContext: context, sideEffects: [] });

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerHostHandlers } = await import('../../src/socket-handlers/host-handlers.js');
      registerHostHandlers(socket as never, io as never);

      await handlers.get('host:songOver')!();

      expect(mockProcessDjTransition).toHaveBeenCalledWith('session-1', context, { type: 'SONG_ENDED' }, 'host-user-1');
    });

    it('rejects when not in song state', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });

      mockFindById.mockResolvedValue(session);
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers, emittedToSelf } = createMockSocket();
      const { io } = createMockIo();

      const { registerHostHandlers } = await import('../../src/socket-handlers/host-handlers.js');
      registerHostHandlers(socket as never, io as never);

      await handlers.get('host:songOver')!();

      expect(mockProcessDjTransition).not.toHaveBeenCalled();
      expect(emittedToSelf).toContainEqual({
        event: 'error',
        data: { code: 'INVALID_STATE', message: 'Song over is only valid during song state' },
      });
    });
  });

  describe('host:endParty', () => {
    it('validates host, calls initiateFinale (party:ended deferred to finalizeSession)', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      const finaleContext = createTestDJContext({ sessionId: 'session-1', state: 'finale' as const });

      mockFindById.mockResolvedValue(session);
      mockInitiateFinale.mockResolvedValue(finaleContext);

      const { socket, handlers } = createMockSocket();
      const { io, emittedToRoom } = createMockIo();

      const { registerHostHandlers } = await import('../../src/socket-handlers/host-handlers.js');
      registerHostHandlers(socket as never, io as never);

      await handlers.get('host:endParty')!();

      expect(mockInitiateFinale).toHaveBeenCalledWith('session-1', 'host-user-1');
      // party:ended is NOT emitted here — deferred to finalizeSession
      const partyEndedEvents = emittedToRoom.filter(
        (e: { event: string }) => e.event === 'party:ended',
      );
      expect(partyEndedEvents).toHaveLength(0);
    });
  });

  describe('host:pause', () => {
    it('validates host and calls pauseSession', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      mockFindById.mockResolvedValue(session);
      mockPauseSession.mockResolvedValue(createTestDJContext({ isPaused: true }));

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerHostHandlers } = await import('../../src/socket-handlers/host-handlers.js');
      registerHostHandlers(socket as never, io as never);

      await handlers.get('host:pause')!();

      expect(mockPauseSession).toHaveBeenCalledWith('session-1', 'host-user-1');
    });

    it('rejects non-host users', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'other-user' });
      mockFindById.mockResolvedValue(session);

      const { socket, handlers, emittedToSelf } = createMockSocket();
      const { io } = createMockIo();

      const { registerHostHandlers } = await import('../../src/socket-handlers/host-handlers.js');
      registerHostHandlers(socket as never, io as never);

      await handlers.get('host:pause')!();

      expect(mockPauseSession).not.toHaveBeenCalled();
      expect(emittedToSelf).toContainEqual({
        event: 'error',
        data: { code: 'NOT_HOST', message: 'Only the host can perform this action' },
      });
    });

    it('emits ALREADY_PAUSED error when session is already paused', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      mockFindById.mockResolvedValue(session);
      mockPauseSession.mockRejectedValue({ code: 'ALREADY_PAUSED', message: 'Session is already paused' });

      const { socket, handlers, emittedToSelf } = createMockSocket();
      const { io } = createMockIo();

      const { registerHostHandlers } = await import('../../src/socket-handlers/host-handlers.js');
      registerHostHandlers(socket as never, io as never);

      await handlers.get('host:pause')!();

      expect(emittedToSelf).toContainEqual({
        event: 'error',
        data: { code: 'ALREADY_PAUSED', message: 'Session is already paused' },
      });
    });
  });

  describe('host:resume', () => {
    it('validates host and calls resumeSession', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      mockFindById.mockResolvedValue(session);
      mockResumeSession.mockResolvedValue(createTestDJContext({ isPaused: false }));

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerHostHandlers } = await import('../../src/socket-handlers/host-handlers.js');
      registerHostHandlers(socket as never, io as never);

      await handlers.get('host:resume')!();

      expect(mockResumeSession).toHaveBeenCalledWith('session-1', 'host-user-1');
    });

    it('rejects non-host users', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'other-user' });
      mockFindById.mockResolvedValue(session);

      const { socket, handlers, emittedToSelf } = createMockSocket();
      const { io } = createMockIo();

      const { registerHostHandlers } = await import('../../src/socket-handlers/host-handlers.js');
      registerHostHandlers(socket as never, io as never);

      await handlers.get('host:resume')!();

      expect(mockResumeSession).not.toHaveBeenCalled();
      expect(emittedToSelf).toContainEqual({
        event: 'error',
        data: { code: 'NOT_HOST', message: 'Only the host can perform this action' },
      });
    });

    it('emits NOT_PAUSED error when session is not paused', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      mockFindById.mockResolvedValue(session);
      mockResumeSession.mockRejectedValue({ code: 'NOT_PAUSED', message: 'Session is not paused' });

      const { socket, handlers, emittedToSelf } = createMockSocket();
      const { io } = createMockIo();

      const { registerHostHandlers } = await import('../../src/socket-handlers/host-handlers.js');
      registerHostHandlers(socket as never, io as never);

      await handlers.get('host:resume')!();

      expect(emittedToSelf).toContainEqual({
        event: 'error',
        data: { code: 'NOT_PAUSED', message: 'Session is not paused' },
      });
    });
  });

  describe('pause guard on host:skip', () => {
    it('returns SESSION_PAUSED error when session is paused', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const, isPaused: true });

      mockFindById.mockResolvedValue(session);
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers, emittedToSelf } = createMockSocket();
      const { io } = createMockIo();

      const { registerHostHandlers } = await import('../../src/socket-handlers/host-handlers.js');
      registerHostHandlers(socket as never, io as never);

      await handlers.get('host:skip')!();

      expect(mockProcessDjTransition).not.toHaveBeenCalled();
      expect(emittedToSelf).toContainEqual({
        event: 'error',
        data: { code: 'SESSION_PAUSED', message: 'Cannot skip while paused — resume first' },
      });
    });
  });

  describe('pause guard on host:override', () => {
    it('returns SESSION_PAUSED error when session is paused', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const, isPaused: true });

      mockFindById.mockResolvedValue(session);
      mockIsValidOverrideTarget.mockReturnValue(true);
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers, emittedToSelf } = createMockSocket();
      const { io } = createMockIo();

      const { registerHostHandlers } = await import('../../src/socket-handlers/host-handlers.js');
      registerHostHandlers(socket as never, io as never);

      await handlers.get('host:override')!({ targetState: 'ceremony' });

      expect(mockProcessDjTransition).not.toHaveBeenCalled();
      expect(emittedToSelf).toContainEqual({
        event: 'error',
        data: { code: 'SESSION_PAUSED', message: 'Cannot override while paused — resume first' },
      });
    });
  });

  describe('event stream logging', () => {
    it('HOST_SKIP appends host:skip event', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });

      mockFindById.mockResolvedValue(session);
      mockGetSessionDjState.mockReturnValue(context);
      mockProcessDjTransition.mockResolvedValue({ newContext: context, sideEffects: [] });

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerHostHandlers } = await import('../../src/socket-handlers/host-handlers.js');
      registerHostHandlers(socket as never, io as never);
      await handlers.get('host:skip')!();

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'host:skip',
        userId: 'host-user-1',
        data: { fromState: 'songSelection' },
      }));
    });

    it('HOST_OVERRIDE appends host:override event', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });

      mockFindById.mockResolvedValue(session);
      mockIsValidOverrideTarget.mockReturnValue(true);
      mockGetSessionDjState.mockReturnValue(context);
      mockProcessDjTransition.mockResolvedValue({ newContext: context, sideEffects: [] });

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerHostHandlers } = await import('../../src/socket-handlers/host-handlers.js');
      registerHostHandlers(socket as never, io as never);
      await handlers.get('host:override')!({ targetState: 'ceremony' });

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'host:override',
        userId: 'host-user-1',
        data: { fromState: 'songSelection', toState: 'ceremony' },
      }));
    });

    it('HOST_SONG_OVER appends host:songOver event', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });

      mockFindById.mockResolvedValue(session);
      mockGetSessionDjState.mockReturnValue(context);
      mockProcessDjTransition.mockResolvedValue({ newContext: context, sideEffects: [] });

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerHostHandlers } = await import('../../src/socket-handlers/host-handlers.js');
      registerHostHandlers(socket as never, io as never);
      await handlers.get('host:songOver')!();

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'host:songOver',
        userId: 'host-user-1',
        data: { fromState: 'song' },
      }));
    });

    it('HOST_PAUSE passes userId to pauseSession', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      mockFindById.mockResolvedValue(session);
      mockPauseSession.mockResolvedValue(createTestDJContext({ isPaused: true }));

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerHostHandlers } = await import('../../src/socket-handlers/host-handlers.js');
      registerHostHandlers(socket as never, io as never);
      await handlers.get('host:pause')!();

      expect(mockPauseSession).toHaveBeenCalledWith('session-1', 'host-user-1');
    });

    it('HOST_RESUME passes userId to resumeSession', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      mockFindById.mockResolvedValue(session);
      mockResumeSession.mockResolvedValue(createTestDJContext({ isPaused: false }));

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerHostHandlers } = await import('../../src/socket-handlers/host-handlers.js');
      registerHostHandlers(socket as never, io as never);
      await handlers.get('host:resume')!();

      expect(mockResumeSession).toHaveBeenCalledWith('session-1', 'host-user-1');
    });
  });

  describe('host:kickPlayer', () => {
    it('validates host, kicks player, emits to kicked socket and disconnects, broadcasts to room', async () => {
      const session = createTestSession({ id: 'session-1', host_user_id: 'host-user-1' });
      mockFindById.mockResolvedValue(session);
      mockKickPlayer.mockResolvedValue({ kickedUserId: 'target-user-1' });
      mockGetActiveConnections.mockReturnValue([
        { socketId: 'kicked-socket-id', userId: 'target-user-1', displayName: 'Target', connectedAt: Date.now(), isHost: false },
      ]);

      const { socket, handlers, emittedToRoom } = createMockSocket();
      const { io, emittedToSocket, disconnectedSockets } = createMockIo();

      const { registerHostHandlers } = await import('../../src/socket-handlers/host-handlers.js');
      registerHostHandlers(socket as never, io as never);

      await handlers.get('host:kickPlayer')!({ userId: 'target-user-1' });

      expect(mockKickPlayer).toHaveBeenCalledWith('session-1', 'host-user-1', 'target-user-1');
      // Emitted to kicked socket
      expect(emittedToSocket).toContainEqual({
        socketId: 'kicked-socket-id',
        event: 'party:participantRemoved',
        data: { userId: 'target-user-1' },
      });
      // Force disconnected
      expect(disconnectedSockets).toContain('kicked-socket-id');
      // Broadcast to room
      expect(emittedToRoom).toContainEqual({
        event: 'party:participantRemoved',
        data: { userId: 'target-user-1', reason: 'kicked' },
      });
    });
  });
});
