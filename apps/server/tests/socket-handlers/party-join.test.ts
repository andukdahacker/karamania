import { describe, it, expect, vi, beforeEach } from 'vitest';
import { EVENTS } from '../../src/shared/events.js';

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

const mockHandleParticipantJoin = vi.fn();
const mockTransferHost = vi.fn();
vi.mock('../../src/services/session-manager.js', () => ({
  handleParticipantJoin: mockHandleParticipantJoin,
  transferHost: mockTransferHost,
}));

vi.mock('./../../src/socket-handlers/auth-middleware.js', () => ({
  createAuthMiddleware: () => (_socket: unknown, next: () => void) => next(),
}));

vi.mock('../../src/socket-handlers/party-handlers.js', () => ({
  registerPartyHandlers: vi.fn(),
}));

const mockTrackConnection = vi.fn().mockReturnValue({ isReconnection: false });
const mockTrackDisconnection = vi.fn();
const mockGetActiveConnections = vi.fn().mockReturnValue([]);
const mockGetLongestConnected = vi.fn();
const mockRemoveDisconnectedEntry = vi.fn();
const mockUpdateHostStatus = vi.fn();

vi.mock('../../src/services/connection-tracker.js', () => ({
  trackConnection: mockTrackConnection,
  trackDisconnection: mockTrackDisconnection,
  getActiveConnections: mockGetActiveConnections,
  getLongestConnected: mockGetLongestConnected,
  removeDisconnectedEntry: mockRemoveDisconnectedEntry,
  updateHostStatus: mockUpdateHostStatus,
}));

function createMockSocket(data: { userId: string; sessionId: string; role: string; displayName: string }) {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  return {
    id: `socket-${data.userId}`,
    data,
    emit: vi.fn(),
    to: vi.fn().mockReturnValue({ emit: vi.fn() }),
    on: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      handlers[event] = handler;
    }),
    join: vi.fn(),
    handshake: { auth: {} },
    _handlers: handlers,
    _toEmit: vi.fn(),
  };
}

function createMockIO() {
  const middlewares: Array<(socket: unknown, next: (err?: Error) => void) => void> = [];
  const connectionHandlers: Array<(socket: unknown) => void> = [];

  return {
    use: vi.fn().mockImplementation((fn: (socket: unknown, next: (err?: Error) => void) => void) => {
      middlewares.push(fn);
    }),
    on: vi.fn().mockImplementation((event: string, handler: (socket: unknown) => void) => {
      if (event === 'connection') connectionHandlers.push(handler);
    }),
    to: vi.fn().mockReturnValue({ emit: vi.fn() }),
    _simulateConnection: async (socket: ReturnType<typeof createMockSocket>) => {
      for (const mw of middlewares) {
        await new Promise<void>((resolve, reject) => {
          mw(socket, (err?: Error) => {
            if (err) reject(err);
            else resolve();
          });
        });
      }
      for (const handler of connectionHandlers) {
        await handler(socket);
      }
    },
  };
}

const mockLogger = {
  info: vi.fn(),
  error: vi.fn(),
  warn: vi.fn(),
  debug: vi.fn(),
  fatal: vi.fn(),
  trace: vi.fn(),
  child: vi.fn(),
  level: 'info',
  silent: vi.fn(),
} as never;

describe('party-join (connection handler)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTrackConnection.mockReturnValue({ isReconnection: false });
    mockGetActiveConnections.mockReturnValue([]);
  });

  it('broadcasts party:joined to other sockets in the room on new connection', async () => {
    const joinResult = {
      participants: [
        { userId: 'user-1', displayName: 'Host' },
        { userId: 'guest-1', displayName: 'Alice' },
      ],
      participantCount: 2,
      vibe: 'rock',
      status: 'lobby',
      hostUserId: 'user-1',
    };
    mockHandleParticipantJoin.mockResolvedValue(joinResult);

    const io = createMockIO();
    const { setupSocketHandlers } = await import('../../src/socket-handlers/connection-handler.js');
    setupSocketHandlers(io as never, mockLogger);

    const socket = createMockSocket({
      userId: 'guest-1',
      sessionId: 'session-1',
      role: 'guest',
      displayName: 'Alice',
    });

    await io._simulateConnection(socket);

    // Verify broadcast to room
    expect(socket.to).toHaveBeenCalledWith('session-1');
    const toResult = socket.to.mock.results[0]!.value;
    expect(toResult.emit).toHaveBeenCalledWith(EVENTS.PARTY_JOINED, {
      userId: 'guest-1',
      displayName: 'Alice',
      participantCount: 2,
    });
  });

  it('sends party:participants with isOnline and hostUserId to newly connected socket', async () => {
    const joinResult = {
      participants: [
        { userId: 'user-1', displayName: 'Host' },
        { userId: 'guest-1', displayName: 'Alice' },
      ],
      participantCount: 2,
      vibe: 'rock',
      status: 'lobby',
      hostUserId: 'user-1',
    };
    mockHandleParticipantJoin.mockResolvedValue(joinResult);
    // Simulate only the connecting user being active
    mockGetActiveConnections.mockReturnValue([
      { userId: 'guest-1', socketId: 'socket-guest-1', displayName: 'Alice', connectedAt: 1000, isHost: false },
    ]);

    const io = createMockIO();
    const { setupSocketHandlers } = await import('../../src/socket-handlers/connection-handler.js');
    setupSocketHandlers(io as never, mockLogger);

    const socket = createMockSocket({
      userId: 'guest-1',
      sessionId: 'session-1',
      role: 'guest',
      displayName: 'Alice',
    });

    await io._simulateConnection(socket);

    expect(socket.emit).toHaveBeenCalledWith(EVENTS.PARTY_PARTICIPANTS, {
      participants: [
        { userId: 'user-1', displayName: 'Host', isOnline: false },
        { userId: 'guest-1', displayName: 'Alice', isOnline: true },
      ],
      participantCount: 2,
      vibe: 'rock',
      status: 'lobby',
      hostUserId: 'user-1',
    });
  });

  it('party:participants response includes status field', async () => {
    const joinResult = {
      participants: [
        { userId: 'user-1', displayName: 'Host' },
      ],
      participantCount: 1,
      vibe: 'general',
      status: 'active',
      hostUserId: 'user-1',
    };
    mockHandleParticipantJoin.mockResolvedValue(joinResult);

    const io = createMockIO();
    const { setupSocketHandlers } = await import('../../src/socket-handlers/connection-handler.js');
    setupSocketHandlers(io as never, mockLogger);

    const socket = createMockSocket({
      userId: 'user-1',
      sessionId: 'session-1',
      role: 'authenticated',
      displayName: 'Host',
    });

    await io._simulateConnection(socket);

    expect(socket.emit).toHaveBeenCalledWith(EVENTS.PARTY_PARTICIPANTS, expect.objectContaining({
      status: 'active',
    }));
  });

  it('calls handleParticipantJoin with correct params', async () => {
    mockHandleParticipantJoin.mockResolvedValue({
      participants: [],
      participantCount: 0,
      vibe: 'general',
      status: 'lobby',
      hostUserId: '',
    });

    const io = createMockIO();
    const { setupSocketHandlers } = await import('../../src/socket-handlers/connection-handler.js');
    setupSocketHandlers(io as never, mockLogger);

    const socket = createMockSocket({
      userId: 'guest-uuid',
      sessionId: 'session-42',
      role: 'guest',
      displayName: 'Bob',
    });

    await io._simulateConnection(socket);

    expect(mockHandleParticipantJoin).toHaveBeenCalledWith({
      sessionId: 'session-42',
      userId: 'guest-uuid',
      role: 'guest',
      displayName: 'Bob',
    });
  });

  it('broadcasts party:participantDisconnected via io.to on disconnect', async () => {
    const joinResult = {
      participants: [
        { userId: 'host-1', displayName: 'Host' },
        { userId: 'guest-1', displayName: 'Alice' },
      ],
      participantCount: 2,
      vibe: 'general',
      status: 'lobby',
      hostUserId: 'host-1',
    };
    mockHandleParticipantJoin.mockResolvedValue(joinResult);
    mockTrackDisconnection.mockReturnValue({
      userId: 'guest-1',
      displayName: 'Alice',
      disconnectedAt: Date.now(),
      connectedAt: 1000,
      isHost: false,
    });

    const io = createMockIO();
    const { setupSocketHandlers } = await import('../../src/socket-handlers/connection-handler.js');
    setupSocketHandlers(io as never, mockLogger);

    const socket = createMockSocket({
      userId: 'guest-1',
      sessionId: 'session-1',
      role: 'guest',
      displayName: 'Alice',
    });

    await io._simulateConnection(socket);

    // Trigger disconnect
    socket._handlers['disconnect']('transport close');

    expect(mockTrackDisconnection).toHaveBeenCalledWith('session-1', 'guest-1');
    expect(io.to).toHaveBeenCalledWith('session-1');
    const ioToResult = io.to.mock.results[0]!.value;
    expect(ioToResult.emit).toHaveBeenCalledWith(EVENTS.PARTY_PARTICIPANT_DISCONNECTED, {
      userId: 'guest-1',
      displayName: 'Alice',
    });
  });

  it('broadcasts party:participantReconnected on reconnection (not party:joined)', async () => {
    const joinResult = {
      participants: [
        { userId: 'host-1', displayName: 'Host' },
        { userId: 'guest-1', displayName: 'Alice' },
      ],
      participantCount: 2,
      vibe: 'general',
      status: 'active',
      hostUserId: 'host-1',
    };
    mockHandleParticipantJoin.mockResolvedValue(joinResult);
    mockTrackConnection.mockReturnValue({ isReconnection: true });

    const io = createMockIO();
    const { setupSocketHandlers } = await import('../../src/socket-handlers/connection-handler.js');
    setupSocketHandlers(io as never, mockLogger);

    const socket = createMockSocket({
      userId: 'guest-1',
      sessionId: 'session-1',
      role: 'guest',
      displayName: 'Alice',
    });

    await io._simulateConnection(socket);

    // Should broadcast reconnected, NOT joined
    expect(socket.to).toHaveBeenCalledWith('session-1');
    const toResult = socket.to.mock.results[0]!.value;
    expect(toResult.emit).toHaveBeenCalledWith(EVENTS.PARTY_PARTICIPANT_RECONNECTED, {
      userId: 'guest-1',
      displayName: 'Alice',
    });
    expect(toResult.emit).not.toHaveBeenCalledWith(EVENTS.PARTY_JOINED, expect.anything());
  });

  it('host disconnect triggers party:hostTransferred after 60s', async () => {
    vi.useFakeTimers();

    const joinResult = {
      participants: [{ userId: 'host-1', displayName: 'Host' }],
      participantCount: 1,
      vibe: 'general',
      status: 'active',
      hostUserId: 'host-1',
    };
    mockHandleParticipantJoin.mockResolvedValue(joinResult);
    mockTrackDisconnection.mockReturnValue({
      userId: 'host-1',
      displayName: 'Host',
      disconnectedAt: Date.now(),
      connectedAt: 1000,
      isHost: true,
    });
    mockGetLongestConnected.mockReturnValue({
      userId: 'guest-1',
      socketId: 'socket-guest-1',
      displayName: 'Alice',
      connectedAt: 2000,
      isHost: false,
    });
    mockTransferHost.mockResolvedValue({
      newHostId: 'guest-1',
      newHostName: 'Alice',
    });

    const io = createMockIO();
    const { setupSocketHandlers } = await import('../../src/socket-handlers/connection-handler.js');
    setupSocketHandlers(io as never, mockLogger);

    const socket = createMockSocket({
      userId: 'host-1',
      sessionId: 'session-1',
      role: 'authenticated',
      displayName: 'Host',
    });

    await io._simulateConnection(socket);
    socket._handlers['disconnect']('transport close');

    // Transfer should not have happened yet
    expect(mockTransferHost).not.toHaveBeenCalled();

    // Advance 60 seconds
    await vi.advanceTimersByTimeAsync(60_000);

    expect(mockTransferHost).toHaveBeenCalledWith('session-1', 'guest-1');
    expect(mockUpdateHostStatus).toHaveBeenCalledWith('session-1', 'host-1', 'guest-1');

    vi.useRealTimers();
  });

  it('non-host disconnect does not trigger host transfer timer', async () => {
    const joinResult = {
      participants: [
        { userId: 'host-1', displayName: 'Host' },
        { userId: 'guest-1', displayName: 'Alice' },
      ],
      participantCount: 2,
      vibe: 'general',
      status: 'active',
      hostUserId: 'host-1',
    };
    mockHandleParticipantJoin.mockResolvedValue(joinResult);
    mockTrackDisconnection.mockReturnValue({
      userId: 'guest-1',
      displayName: 'Alice',
      disconnectedAt: Date.now(),
      connectedAt: 2000,
      isHost: false,
    });

    const io = createMockIO();
    const { setupSocketHandlers } = await import('../../src/socket-handlers/connection-handler.js');
    setupSocketHandlers(io as never, mockLogger);

    const socket = createMockSocket({
      userId: 'guest-1',
      sessionId: 'session-1',
      role: 'guest',
      displayName: 'Alice',
    });

    await io._simulateConnection(socket);
    socket._handlers['disconnect']('transport close');

    // getLongestConnected should NOT have been called (no host transfer logic for non-host)
    expect(mockGetLongestConnected).not.toHaveBeenCalled();
    expect(mockTransferHost).not.toHaveBeenCalled();
  });

  it('does not crash if handleParticipantJoin throws', async () => {
    mockHandleParticipantJoin.mockRejectedValue(new Error('DB error'));

    const io = createMockIO();
    const { setupSocketHandlers } = await import('../../src/socket-handlers/connection-handler.js');
    setupSocketHandlers(io as never, mockLogger);

    const socket = createMockSocket({
      userId: 'guest-1',
      sessionId: 'session-1',
      role: 'guest',
      displayName: 'Alice',
    });

    // Should not throw
    await io._simulateConnection(socket);

    expect(mockLogger.error).toHaveBeenCalled();
  });
});
