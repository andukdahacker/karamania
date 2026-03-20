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

const mockSaveFeedback = vi.fn();
vi.mock('../../src/services/session-manager.js', () => ({
  saveFeedback: (...args: unknown[]) => mockSaveFeedback(...args),
}));

function createMockSocket(overrides: Partial<{ userId: string; sessionId: string }> = {}) {
  const handlers = new Map<string, (data?: unknown) => Promise<void>>();

  return {
    socket: {
      data: {
        userId: overrides.userId ?? 'user-1',
        sessionId: overrides.sessionId ?? 'session-1',
        role: 'authenticated' as const,
        displayName: 'TestUser',
      },
      on: (event: string, handler: (data?: unknown) => Promise<void>) => {
        handlers.set(event, handler);
      },
      emit: vi.fn(),
    },
    handlers,
  };
}

function createMockIo() {
  return {
    io: {
      to: () => ({
        emit: vi.fn(),
      }),
    },
  };
}

describe('finale-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    // Reset the module-level feedbackSubmitted Map between tests
    vi.resetModules();
  });

  describe('finale:feedback', () => {
    it('calls saveFeedback for valid score (1-5 integer)', async () => {
      mockSaveFeedback.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket({ userId: 'user-1', sessionId: 'session-1' });
      const { io } = createMockIo();

      const { registerFinaleHandlers } = await import('../../src/socket-handlers/finale-handlers.js');
      registerFinaleHandlers(socket as never, io as never);

      await handlers.get('finale:feedback')!({ score: 3 });

      expect(mockSaveFeedback).toHaveBeenCalledWith('session-1', 'user-1', 3);
    });

    it('accepts score of 1 (minimum)', async () => {
      mockSaveFeedback.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerFinaleHandlers } = await import('../../src/socket-handlers/finale-handlers.js');
      registerFinaleHandlers(socket as never, io as never);

      await handlers.get('finale:feedback')!({ score: 1 });

      expect(mockSaveFeedback).toHaveBeenCalledWith('session-1', 'user-1', 1);
    });

    it('accepts score of 5 (maximum)', async () => {
      mockSaveFeedback.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerFinaleHandlers } = await import('../../src/socket-handlers/finale-handlers.js');
      registerFinaleHandlers(socket as never, io as never);

      await handlers.get('finale:feedback')!({ score: 5 });

      expect(mockSaveFeedback).toHaveBeenCalledWith('session-1', 'user-1', 5);
    });

    it('silently ignores score of 0 (below minimum)', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerFinaleHandlers } = await import('../../src/socket-handlers/finale-handlers.js');
      registerFinaleHandlers(socket as never, io as never);

      await handlers.get('finale:feedback')!({ score: 0 });

      expect(mockSaveFeedback).not.toHaveBeenCalled();
    });

    it('silently ignores score of 6 (above maximum)', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerFinaleHandlers } = await import('../../src/socket-handlers/finale-handlers.js');
      registerFinaleHandlers(socket as never, io as never);

      await handlers.get('finale:feedback')!({ score: 6 });

      expect(mockSaveFeedback).not.toHaveBeenCalled();
    });

    it('silently ignores non-integer score', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerFinaleHandlers } = await import('../../src/socket-handlers/finale-handlers.js');
      registerFinaleHandlers(socket as never, io as never);

      await handlers.get('finale:feedback')!({ score: 3.5 });

      expect(mockSaveFeedback).not.toHaveBeenCalled();
    });

    it('silently ignores missing score', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerFinaleHandlers } = await import('../../src/socket-handlers/finale-handlers.js');
      registerFinaleHandlers(socket as never, io as never);

      await handlers.get('finale:feedback')!({});

      expect(mockSaveFeedback).not.toHaveBeenCalled();
    });

    it('silently ignores duplicate submission (second attempt has no effect)', async () => {
      mockSaveFeedback.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket({ userId: 'user-dup', sessionId: 'session-dup' });
      const { io } = createMockIo();

      const { registerFinaleHandlers } = await import('../../src/socket-handlers/finale-handlers.js');
      registerFinaleHandlers(socket as never, io as never);

      // First submission should succeed
      await handlers.get('finale:feedback')!({ score: 4 });
      expect(mockSaveFeedback).toHaveBeenCalledTimes(1);

      // Second submission should be silently ignored
      await handlers.get('finale:feedback')!({ score: 5 });
      expect(mockSaveFeedback).toHaveBeenCalledTimes(1);
    });

    it('silently ignores non-object payload (null)', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerFinaleHandlers } = await import('../../src/socket-handlers/finale-handlers.js');
      registerFinaleHandlers(socket as never, io as never);

      await handlers.get('finale:feedback')!(null);

      expect(mockSaveFeedback).not.toHaveBeenCalled();
    });

    it('silently ignores non-object payload (string)', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerFinaleHandlers } = await import('../../src/socket-handlers/finale-handlers.js');
      registerFinaleHandlers(socket as never, io as never);

      await handlers.get('finale:feedback')!('invalid');

      expect(mockSaveFeedback).not.toHaveBeenCalled();
    });

    it('silently ignores non-object payload (undefined)', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerFinaleHandlers } = await import('../../src/socket-handlers/finale-handlers.js');
      registerFinaleHandlers(socket as never, io as never);

      await handlers.get('finale:feedback')!(undefined);

      expect(mockSaveFeedback).not.toHaveBeenCalled();
    });
  });
});
