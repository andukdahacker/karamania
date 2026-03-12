import { describe, it, expect, vi, beforeEach } from 'vitest';

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

const mockUpdateVibe = vi.fn();
vi.mock('../../src/persistence/session-repository.js', () => ({
  updateVibe: mockUpdateVibe,
}));

const mockStartSession = vi.fn();
const mockRecordParticipationAction = vi.fn();
vi.mock('../../src/services/session-manager.js', () => ({
  startSession: mockStartSession,
  recordParticipationAction: (...args: unknown[]) => mockRecordParticipationAction(...args),
}));

const mockBroadcastDjState = vi.fn();
vi.mock('../../src/services/dj-broadcaster.js', () => ({
  broadcastDjState: mockBroadcastDjState,
}));

const mockAppendEvent = vi.fn();
vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

vi.mock('../../src/services/activity-tracker.js', () => ({
  recordActivity: vi.fn(),
}));

const mockCheckRateLimit = vi.fn().mockReturnValue({ allowed: true, rewardMultiplier: 1.0 });
const mockRecordUserEvent = vi.fn().mockReturnValue([]);
vi.mock('../../src/services/rate-limiter.js', () => ({
  checkRateLimit: (...args: unknown[]) => mockCheckRateLimit(...args),
  recordUserEvent: (...args: unknown[]) => mockRecordUserEvent(...args),
}));

function createMockSocket(sessionId = 'test-session-id') {
  const handlers = new Map<string, (data: unknown) => void>();
  const emittedToRoom: Array<{ event: string; data: unknown }> = [];
  const emittedToSelf: Array<{ event: string; data: unknown }> = [];

  return {
    socket: {
      data: {
        userId: 'test-user-id',
        sessionId,
        role: 'authenticated' as const,
        displayName: 'Test User',
      },
      on: (event: string, handler: (data: unknown) => void) => {
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
    emittedToRoom,
    emittedToSelf,
  };
}

describe('party-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('party:vibeChanged', () => {
    it('with valid vibe updates DB and broadcasts to room', async () => {
      mockUpdateVibe.mockResolvedValue(undefined);
      const { socket, handlers, emittedToRoom } = createMockSocket('session-123');

      const { registerPartyHandlers } = await import('../../src/socket-handlers/party-handlers.js');
      registerPartyHandlers(socket as never);

      const handler = handlers.get('party:vibeChanged');
      expect(handler).toBeDefined();

      await handler!({ vibe: 'rock' });

      expect(mockUpdateVibe).toHaveBeenCalledWith('session-123', 'rock');
      expect(emittedToRoom).toHaveLength(1);
      expect(emittedToRoom[0]).toEqual({
        event: 'party:vibeChanged',
        data: { vibe: 'rock' },
      });
    });

    it('with invalid vibe is silently ignored', async () => {
      const { socket, handlers, emittedToRoom } = createMockSocket();

      const { registerPartyHandlers } = await import('../../src/socket-handlers/party-handlers.js');
      registerPartyHandlers(socket as never);

      const handler = handlers.get('party:vibeChanged');
      await handler!({ vibe: 'invalid-vibe' });

      expect(mockUpdateVibe).not.toHaveBeenCalled();
      expect(emittedToRoom).toHaveLength(0);
    });

    it('broadcasts using socket.to(sessionId).emit()', async () => {
      mockUpdateVibe.mockResolvedValue(undefined);
      const toSpy = vi.fn().mockReturnValue({ emit: vi.fn() });
      const socket = {
        data: { userId: 'u1', sessionId: 's1', role: 'authenticated', displayName: 'User' },
        on: vi.fn(),
        to: toSpy,
      };

      const { registerPartyHandlers } = await import('../../src/socket-handlers/party-handlers.js');
      registerPartyHandlers(socket as never);

      // Get the registered handler
      const onCall = socket.on.mock.calls.find(
        (call: unknown[]) => call[0] === 'party:vibeChanged'
      );
      expect(onCall).toBeDefined();
      const handler = onCall![1] as (data: { vibe: string }) => Promise<void>;

      await handler({ vibe: 'kpop' });

      expect(toSpy).toHaveBeenCalledWith('s1');
    });
  });

  describe('participation scoring on vibe change', () => {
    it('calls rate limiter and recordParticipationAction with rewardMultiplier', async () => {
      mockUpdateVibe.mockResolvedValue(undefined);
      mockRecordUserEvent.mockReturnValue([1000, 2000, 3000]);
      mockCheckRateLimit.mockReturnValue({ allowed: true, rewardMultiplier: 0.5 });

      const { socket, handlers } = createMockSocket('session-123');

      const { registerPartyHandlers } = await import('../../src/socket-handlers/party-handlers.js');
      registerPartyHandlers(socket as never);

      await handlers.get('party:vibeChanged')!({ vibe: 'rock' });

      expect(mockRecordUserEvent).toHaveBeenCalledWith('test-user-id', expect.any(Number));
      expect(mockCheckRateLimit).toHaveBeenCalledWith(
        [1000, 2000, 3000],
        expect.any(Number),
      );
      expect(mockRecordParticipationAction).toHaveBeenCalledWith(
        'session-123',
        'test-user-id',
        'party:vibeChanged',
        0.5,
      );
    });
  });

  describe('event stream logging', () => {
    it('PARTY_VIBE_CHANGED appends party:vibeChanged event', async () => {
      mockUpdateVibe.mockResolvedValue(undefined);
      const { socket, handlers } = createMockSocket('session-123');

      const { registerPartyHandlers } = await import('../../src/socket-handlers/party-handlers.js');
      registerPartyHandlers(socket as never);

      await handlers.get('party:vibeChanged')!({ vibe: 'rock' });

      expect(mockAppendEvent).toHaveBeenCalledWith('session-123', expect.objectContaining({
        type: 'party:vibeChanged',
        userId: 'test-user-id',
        data: { vibe: 'rock' },
      }));
    });
  });

  describe('party:start', () => {
    it('emits party:started AND dj:stateChanged on successful start', async () => {
      const djContext = {
        state: 'songSelection',
        sessionId: 'session-1',
        participantCount: 5,
        songCount: 0,
        currentPerformer: null,
        timerStartedAt: null,
        timerDurationMs: null,
        sessionStartedAt: Date.now(),
        cycleHistory: ['lobby', 'songSelection'],
        metadata: {},
      };
      mockStartSession.mockResolvedValue({
        status: 'active',
        djContext,
        sideEffects: [],
      });

      const { socket, handlers, emittedToRoom, emittedToSelf } = createMockSocket('session-1');

      const { registerPartyHandlers } = await import('../../src/socket-handlers/party-handlers.js');
      registerPartyHandlers(socket as never);

      const handler = handlers.get('party:start');
      expect(handler).toBeDefined();

      await handler!(undefined);

      expect(mockStartSession).toHaveBeenCalledWith({
        sessionId: 'session-1',
        hostUserId: 'test-user-id',
      });

      // party:started emitted to self
      expect(emittedToSelf).toContainEqual({
        event: 'party:started',
        data: { status: 'active' },
      });

      // party:started emitted to room
      expect(emittedToRoom).toContainEqual({
        event: 'party:started',
        data: { status: 'active' },
      });

      // dj:stateChanged broadcast via broadcastDjState
      expect(mockBroadcastDjState).toHaveBeenCalledWith('session-1', djContext);
    });

    it('silently fails when startSession throws', async () => {
      mockStartSession.mockRejectedValue(new Error('Not host'));

      const { socket, handlers, emittedToSelf, emittedToRoom } = createMockSocket('session-1');

      const { registerPartyHandlers } = await import('../../src/socket-handlers/party-handlers.js');
      registerPartyHandlers(socket as never);

      const handler = handlers.get('party:start');
      await handler!(undefined);

      expect(emittedToSelf).toHaveLength(0);
      expect(emittedToRoom).toHaveLength(0);
      expect(mockBroadcastDjState).not.toHaveBeenCalled();
    });
  });
});
