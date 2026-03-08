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

function createMockSocket(sessionId = 'test-session-id') {
  const handlers = new Map<string, (data: unknown) => void>();
  const emittedToRoom: Array<{ event: string; data: unknown }> = [];

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
      to: (roomId: string) => ({
        emit: (event: string, data: unknown) => {
          emittedToRoom.push({ event, data });
        },
      }),
    },
    handlers,
    emittedToRoom,
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
});
