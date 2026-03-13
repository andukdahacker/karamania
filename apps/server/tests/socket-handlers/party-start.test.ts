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

const mockStartSession = vi.fn();
vi.mock('../../src/services/session-manager.js', () => ({
  startSession: mockStartSession,
  handleParticipantJoin: vi.fn(),
}));

const mockBroadcastDjState = vi.fn();
vi.mock('../../src/services/dj-broadcaster.js', () => ({
  broadcastDjState: mockBroadcastDjState,
  broadcastCeremonyAnticipation: vi.fn(),
  broadcastCeremonyReveal: vi.fn(),
  broadcastCeremonyQuick: vi.fn(),
}));

const mockUpdateVibe = vi.fn();
vi.mock('../../src/persistence/session-repository.js', () => ({
  updateVibe: mockUpdateVibe,
  updateStatus: vi.fn(),
}));

function createMockSocket(overrides: {
  userId?: string;
  sessionId?: string;
  role?: string;
  displayName?: string;
} = {}) {
  const handlers = new Map<string, (...args: unknown[]) => Promise<void> | void>();
  const roomEmits: Array<{ event: string; data: unknown }> = [];
  const directEmits: Array<{ event: string; data: unknown }> = [];

  const toEmit = vi.fn().mockImplementation((event: string, data: unknown) => {
    roomEmits.push({ event, data });
  });

  const socket = {
    data: {
      userId: overrides.userId ?? 'host-user',
      sessionId: overrides.sessionId ?? 'session-1',
      role: overrides.role ?? 'authenticated',
      displayName: overrides.displayName ?? 'Host User',
    },
    on: vi.fn().mockImplementation((event: string, handler: (...args: unknown[]) => void) => {
      handlers.set(event, handler);
    }),
    emit: vi.fn().mockImplementation((event: string, data: unknown) => {
      directEmits.push({ event, data });
    }),
    to: vi.fn().mockReturnValue({ emit: toEmit }),
  };

  return { socket, handlers, roomEmits, directEmits, toEmit };
}

describe('party:start handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('when host emits party:start, party:started is broadcast to all sockets in room', async () => {
    mockStartSession.mockResolvedValue({
      status: 'active',
      djContext: { state: 'songSelection', sessionId: 'session-1', songCount: 0, participantCount: 3, currentPerformer: null, timerStartedAt: null, timerDurationMs: null },
      sideEffects: [],
    });

    const { socket, handlers } = createMockSocket({ userId: 'host-user', sessionId: 'session-1' });

    const { registerPartyHandlers } = await import('../../src/socket-handlers/party-handlers.js');
    registerPartyHandlers(socket as never);

    const handler = handlers.get(EVENTS.PARTY_START);
    expect(handler).toBeDefined();
    await handler!();

    expect(socket.to).toHaveBeenCalledWith('session-1');
    const toResult = socket.to.mock.results[0]!.value;
    expect(toResult.emit).toHaveBeenCalledWith(EVENTS.PARTY_STARTED, { status: 'active' });
  });

  it('party:started payload contains { status: "active" }', async () => {
    mockStartSession.mockResolvedValue({
      status: 'active',
      djContext: { state: 'songSelection', sessionId: 'session-1', songCount: 0, participantCount: 3, currentPerformer: null, timerStartedAt: null, timerDurationMs: null },
      sideEffects: [],
    });

    const { socket, handlers, directEmits } = createMockSocket({ userId: 'host-user', sessionId: 'session-1' });

    const { registerPartyHandlers } = await import('../../src/socket-handlers/party-handlers.js');
    registerPartyHandlers(socket as never);

    const handler = handlers.get(EVENTS.PARTY_START);
    await handler!();

    expect(directEmits).toContainEqual({ event: EVENTS.PARTY_STARTED, data: { status: 'active' } });
  });

  it('non-host socket emitting party:start does NOT trigger broadcast when startSession throws', async () => {
    mockStartSession.mockRejectedValue({ code: 'NOT_HOST', message: 'Only the host can start the party', statusCode: 403 });

    const { socket, handlers, roomEmits, directEmits } = createMockSocket({ userId: 'not-the-host', sessionId: 'session-1' });

    const { registerPartyHandlers } = await import('../../src/socket-handlers/party-handlers.js');
    registerPartyHandlers(socket as never);

    const handler = handlers.get(EVENTS.PARTY_START);
    await handler!();

    expect(roomEmits).toHaveLength(0);
    expect(directEmits).toHaveLength(0);
    expect(socket.to).not.toHaveBeenCalled();
  });

  it('session with < 3 participants: party:start does NOT trigger broadcast', async () => {
    mockStartSession.mockRejectedValue({ code: 'INSUFFICIENT_PLAYERS', message: 'Need at least 3 participants to start', statusCode: 400 });

    const { socket, handlers, roomEmits, directEmits } = createMockSocket({ userId: 'host-user', sessionId: 'session-1' });

    const { registerPartyHandlers } = await import('../../src/socket-handlers/party-handlers.js');
    registerPartyHandlers(socket as never);

    const handler = handlers.get(EVENTS.PARTY_START);
    await handler!();

    expect(roomEmits).toHaveLength(0);
    expect(directEmits).toHaveLength(0);
    expect(socket.to).not.toHaveBeenCalled();
  });

  it('already-active session: party:start does NOT trigger broadcast', async () => {
    mockStartSession.mockRejectedValue({ code: 'INVALID_STATUS', message: 'Party already started', statusCode: 400 });

    const { socket, handlers, roomEmits, directEmits } = createMockSocket({ userId: 'host-user', sessionId: 'session-1' });

    const { registerPartyHandlers } = await import('../../src/socket-handlers/party-handlers.js');
    registerPartyHandlers(socket as never);

    const handler = handlers.get(EVENTS.PARTY_START);
    await handler!();

    expect(roomEmits).toHaveLength(0);
    expect(directEmits).toHaveLength(0);
    expect(socket.to).not.toHaveBeenCalled();
  });
});
