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

vi.mock('../../src/db/connection.js', () => ({ db: {} }));

const mockPairTv = vi.fn();
const mockUnpairTv = vi.fn();
vi.mock('../../src/services/session-manager.js', () => ({
  pairTv: (...args: unknown[]) => mockPairTv(...args),
  unpairTv: (...args: unknown[]) => mockUnpairTv(...args),
  persistDjState: vi.fn(),
}));

const mockAppendEvent = vi.fn();
vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

import { registerTvHandlers } from '../../src/socket-handlers/tv-handlers.js';
import type { AuthenticatedSocket } from '../../src/shared/socket-types.js';
import type { Server as SocketIOServer } from 'socket.io';

function createMockSocket(overrides?: Partial<{ role: string; sessionId: string; userId: string }>) {
  const handlers = new Map<string, Function>();
  const emittedEvents: Array<{ event: string; data: unknown }> = [];

  const socket = {
    data: {
      sessionId: overrides?.sessionId ?? 'session-1',
      userId: overrides?.userId ?? 'user-host',
      displayName: 'Test Host',
      role: overrides?.role ?? 'host',
    },
    on: vi.fn((event: string, handler: Function) => {
      handlers.set(event, handler);
    }),
    emit: vi.fn((event: string, data: unknown) => {
      emittedEvents.push({ event, data });
    }),
  } as unknown as AuthenticatedSocket;

  return { socket, handlers, emittedEvents };
}

function createMockIO() {
  const roomEmitted: Array<{ event: string; data: unknown }> = [];
  return {
    io: {
      to: vi.fn(() => ({
        emit: vi.fn((event: string, data: unknown) => {
          roomEmitted.push({ event, data });
        }),
      })),
    } as unknown as SocketIOServer,
    roomEmitted,
  };
}

describe('tv-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('tv:pair', () => {
    it('pairs TV with valid code when host', async () => {
      const { socket, handlers } = createMockSocket();
      const { io, roomEmitted } = createMockIO();
      mockPairTv.mockResolvedValueOnce(undefined);

      registerTvHandlers(socket, io);

      const handler = handlers.get('tv:pair')!;
      await handler({ pairingCode: 'ABC123' });

      expect(mockPairTv).toHaveBeenCalledWith('session-1', 'ABC123');
      expect(io.to).toHaveBeenCalledWith('session-1');
      expect(roomEmitted[0]).toEqual({
        event: 'tv:status',
        data: { status: 'connected' },
      });
      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'tv:paired',
        userId: 'user-host',
      }));
    });

    it('rejects non-host silently', async () => {
      const { socket, handlers } = createMockSocket({ role: 'guest' });
      const { io } = createMockIO();

      registerTvHandlers(socket, io);

      const handler = handlers.get('tv:pair')!;
      await handler({ pairingCode: 'ABC123' });

      expect(mockPairTv).not.toHaveBeenCalled();
    });

    it('emits disconnected on pairing failure', async () => {
      const { socket, handlers, emittedEvents } = createMockSocket();
      const { io } = createMockIO();
      mockPairTv.mockRejectedValueOnce(new Error('Invalid pairing code'));

      registerTvHandlers(socket, io);

      const handler = handlers.get('tv:pair')!;
      await handler({ pairingCode: 'BAD' });

      expect(emittedEvents[0]).toEqual({
        event: 'tv:status',
        data: { status: 'disconnected', message: 'Invalid pairing code' },
      });
    });

    it('rejects invalid payload silently', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIO();

      registerTvHandlers(socket, io);

      const handler = handlers.get('tv:pair')!;
      await handler({ pairingCode: '' }); // min(1) fails

      expect(mockPairTv).not.toHaveBeenCalled();
    });
  });

  describe('tv:unpair', () => {
    it('unpairs TV when host', async () => {
      const { socket, handlers } = createMockSocket();
      const { io, roomEmitted } = createMockIO();
      mockUnpairTv.mockResolvedValueOnce(undefined);

      registerTvHandlers(socket, io);

      const handler = handlers.get('tv:unpair')!;
      await handler();

      expect(mockUnpairTv).toHaveBeenCalledWith('session-1');
      expect(roomEmitted[0]).toEqual({
        event: 'tv:status',
        data: { status: 'disconnected' },
      });
      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'tv:unpaired',
        userId: 'user-host',
      }));
    });

    it('rejects non-host silently', async () => {
      const { socket, handlers } = createMockSocket({ role: 'guest' });
      const { io } = createMockIO();

      registerTvHandlers(socket, io);

      const handler = handlers.get('tv:unpair')!;
      await handler();

      expect(mockUnpairTv).not.toHaveBeenCalled();
    });
  });
});
