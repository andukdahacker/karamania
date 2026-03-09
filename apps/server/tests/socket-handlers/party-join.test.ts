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
vi.mock('../../src/services/session-manager.js', () => ({
  handleParticipantJoin: mockHandleParticipantJoin,
}));

vi.mock('./../../src/socket-handlers/auth-middleware.js', () => ({
  createAuthMiddleware: () => (_socket: unknown, next: () => void) => next(),
}));

vi.mock('../../src/socket-handlers/party-handlers.js', () => ({
  registerPartyHandlers: vi.fn(),
}));

function createMockSocket(data: { userId: string; sessionId: string; role: string; displayName: string }) {
  const handlers: Record<string, (...args: unknown[]) => void> = {};
  return {
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
  });

  it('broadcasts party:joined to other sockets in the room on connection', async () => {
    const joinResult = {
      participants: [
        { userId: 'user-1', displayName: 'Host' },
        { userId: 'guest-1', displayName: 'Alice' },
      ],
      participantCount: 2,
      vibe: 'rock',
      status: 'lobby',
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

  it('sends party:participants to newly connected socket', async () => {
    const joinResult = {
      participants: [
        { userId: 'user-1', displayName: 'Host' },
        { userId: 'guest-1', displayName: 'Alice' },
      ],
      participantCount: 2,
      vibe: 'rock',
      status: 'lobby',
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

    expect(socket.emit).toHaveBeenCalledWith(EVENTS.PARTY_PARTICIPANTS, {
      participants: joinResult.participants,
      participantCount: 2,
      vibe: 'rock',
      status: 'lobby',
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
