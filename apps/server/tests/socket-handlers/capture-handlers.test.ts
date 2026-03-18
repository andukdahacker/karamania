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

const mockAppendEvent = vi.fn();
vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

const mockGetSessionDjState = vi.fn();
vi.mock('../../src/services/dj-state-store.js', () => ({
  getSessionDjState: (...args: unknown[]) => mockGetSessionDjState(...args),
}));

const mockPersistCaptureMetadata = vi.fn();
vi.mock('../../src/services/capture-service.js', () => ({
  persistCaptureMetadata: (...args: unknown[]) => mockPersistCaptureMetadata(...args),
}));

function createMockSocket(overrides: Partial<{ userId: string; sessionId: string; displayName: string }> = {}) {
  const handlers = new Map<string, (data?: unknown) => void>();
  const emittedEvents: Array<{ event: string; data: unknown }> = [];

  return {
    socket: {
      data: {
        userId: overrides.userId ?? 'user-1',
        sessionId: overrides.sessionId ?? 'session-1',
        role: 'authenticated' as const,
        displayName: overrides.displayName ?? 'Test User',
      },
      on: (event: string, handler: (data?: unknown) => void) => {
        handlers.set(event, handler);
      },
      emit: (event: string, data: unknown) => {
        emittedEvents.push({ event, data });
      },
    },
    handlers,
    emittedEvents,
  };
}

function createMockIo() {
  return {
    io: {
      to: (target: string) => ({
        emit: (event: string, data: unknown) => {},
      }),
    },
  };
}

describe('capture-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockPersistCaptureMetadata.mockResolvedValue('capture-id-123');
  });

  describe('capture:started', () => {
    it('appends capture:started event to event stream with correct data', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCaptureHandlers } = await import('../../src/socket-handlers/capture-handlers.js');
      registerCaptureHandlers(socket as never, io as never);

      handlers.get('capture:started')!({
        captureType: 'photo',
        triggerType: 'session_start',
      });

      expect(mockAppendEvent).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'capture:started',
          userId: 'user-1',
          data: {
            captureType: 'photo',
            triggerType: 'session_start',
          },
        }),
      );
    });

    it('includes ts timestamp in event', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCaptureHandlers } = await import('../../src/socket-handlers/capture-handlers.js');
      registerCaptureHandlers(socket as never, io as never);

      handlers.get('capture:started')!({
        captureType: 'video',
        triggerType: 'reaction_peak',
      });

      expect(mockAppendEvent).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          ts: expect.any(Number),
        }),
      );
    });

    it('ignores event when sessionId is missing', async () => {
      const { socket, handlers } = createMockSocket();
      socket.data.sessionId = '';
      const { io } = createMockIo();

      const { registerCaptureHandlers } = await import('../../src/socket-handlers/capture-handlers.js');
      registerCaptureHandlers(socket as never, io as never);

      handlers.get('capture:started')!({
        captureType: 'photo',
        triggerType: 'manual',
      });

      expect(mockAppendEvent).not.toHaveBeenCalled();
    });

    it('accepts triggerType manual for FR39 persistent capture icon', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCaptureHandlers } = await import('../../src/socket-handlers/capture-handlers.js');
      registerCaptureHandlers(socket as never, io as never);

      handlers.get('capture:started')!({
        captureType: 'audio',
        triggerType: 'manual',
      });

      expect(mockAppendEvent).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'capture:started',
          data: expect.objectContaining({
            captureType: 'audio',
            triggerType: 'manual',
          }),
        }),
      );
    });

    it('ignores event with invalid captureType', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCaptureHandlers } = await import('../../src/socket-handlers/capture-handlers.js');
      registerCaptureHandlers(socket as never, io as never);

      handlers.get('capture:started')!({
        captureType: 'hacked',
        triggerType: 'manual',
      });

      expect(mockAppendEvent).not.toHaveBeenCalled();
    });

    it('ignores event with invalid triggerType', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCaptureHandlers } = await import('../../src/socket-handlers/capture-handlers.js');
      registerCaptureHandlers(socket as never, io as never);

      handlers.get('capture:started')!({
        captureType: 'photo',
        triggerType: 'invalid_trigger',
      });

      expect(mockAppendEvent).not.toHaveBeenCalled();
    });

    it('ignores non-object payload', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCaptureHandlers } = await import('../../src/socket-handlers/capture-handlers.js');
      registerCaptureHandlers(socket as never, io as never);

      handlers.get('capture:started')!('not-an-object');

      expect(mockAppendEvent).not.toHaveBeenCalled();
    });
  });

  describe('capture:complete', () => {
    it('appends capture:complete event to event stream with correct data including durationMs', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCaptureHandlers } = await import('../../src/socket-handlers/capture-handlers.js');
      registerCaptureHandlers(socket as never, io as never);

      handlers.get('capture:complete')!({
        captureType: 'video',
        triggerType: 'post_ceremony',
        durationMs: 4200,
      });

      expect(mockAppendEvent).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'capture:complete',
          userId: 'user-1',
          data: {
            captureType: 'video',
            triggerType: 'post_ceremony',
            durationMs: 4200,
          },
        }),
      );
    });

    it('handles capture:complete without durationMs (photo capture)', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCaptureHandlers } = await import('../../src/socket-handlers/capture-handlers.js');
      registerCaptureHandlers(socket as never, io as never);

      handlers.get('capture:complete')!({
        captureType: 'photo',
        triggerType: 'manual',
      });

      expect(mockAppendEvent).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'capture:complete',
          data: expect.objectContaining({
            captureType: 'photo',
            triggerType: 'manual',
            durationMs: undefined,
          }),
        }),
      );
    });

    it('persists capture metadata via capture-service on capture:complete', async () => {
      const djState = { state: 'song', songCount: 2 };
      mockGetSessionDjState.mockReturnValue(djState);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCaptureHandlers } = await import('../../src/socket-handlers/capture-handlers.js');
      registerCaptureHandlers(socket as never, io as never);

      handlers.get('capture:complete')!({
        captureType: 'photo',
        triggerType: 'manual',
      });

      // Allow promise to resolve
      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(mockGetSessionDjState).toHaveBeenCalledWith('session-1');
      expect(mockPersistCaptureMetadata).toHaveBeenCalledWith({
        sessionId: 'session-1',
        userId: 'user-1',
        captureType: 'photo',
        triggerType: 'manual',
        djStateAtCapture: djState,
      });
    });

    it('emits capture:persisted acknowledgment with captureId after persistence', async () => {
      mockGetSessionDjState.mockReturnValue(undefined);
      mockPersistCaptureMetadata.mockResolvedValue('new-capture-id');

      const { socket, handlers, emittedEvents } = createMockSocket();
      const { io } = createMockIo();

      const { registerCaptureHandlers } = await import('../../src/socket-handlers/capture-handlers.js');
      registerCaptureHandlers(socket as never, io as never);

      handlers.get('capture:complete')!({
        captureType: 'audio',
        triggerType: 'session_end',
        durationMs: 8000,
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(emittedEvents).toContainEqual({
        event: 'capture:persisted',
        data: { captureId: 'new-capture-id' },
      });
    });

    it('does not emit acknowledgment when persistence fails', async () => {
      mockGetSessionDjState.mockReturnValue(undefined);
      mockPersistCaptureMetadata.mockResolvedValue(null);

      const { socket, handlers, emittedEvents } = createMockSocket();
      const { io } = createMockIo();

      const { registerCaptureHandlers } = await import('../../src/socket-handlers/capture-handlers.js');
      registerCaptureHandlers(socket as never, io as never);

      handlers.get('capture:complete')!({
        captureType: 'photo',
        triggerType: 'manual',
      });

      await new Promise((resolve) => setTimeout(resolve, 10));

      expect(emittedEvents).toEqual([]);
    });

    it('ignores event when sessionId is missing', async () => {
      const { socket, handlers } = createMockSocket();
      socket.data.sessionId = '';
      const { io } = createMockIo();

      const { registerCaptureHandlers } = await import('../../src/socket-handlers/capture-handlers.js');
      registerCaptureHandlers(socket as never, io as never);

      handlers.get('capture:complete')!({
        captureType: 'audio',
        triggerType: 'session_end',
        durationMs: 8000,
      });

      expect(mockAppendEvent).not.toHaveBeenCalled();
    });

    it('accepts triggerType manual for FR39 manual capture', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCaptureHandlers } = await import('../../src/socket-handlers/capture-handlers.js');
      registerCaptureHandlers(socket as never, io as never);

      handlers.get('capture:complete')!({
        captureType: 'audio',
        triggerType: 'manual',
        durationMs: 7500,
      });

      expect(mockAppendEvent).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          data: expect.objectContaining({
            triggerType: 'manual',
          }),
        }),
      );
    });

    it('ignores event with invalid captureType', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCaptureHandlers } = await import('../../src/socket-handlers/capture-handlers.js');
      registerCaptureHandlers(socket as never, io as never);

      handlers.get('capture:complete')!({
        captureType: 'malicious',
        triggerType: 'manual',
        durationMs: 1000,
      });

      expect(mockAppendEvent).not.toHaveBeenCalled();
    });

    it('ignores event with non-numeric durationMs', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCaptureHandlers } = await import('../../src/socket-handlers/capture-handlers.js');
      registerCaptureHandlers(socket as never, io as never);

      handlers.get('capture:complete')!({
        captureType: 'audio',
        triggerType: 'manual',
        durationMs: 'not-a-number',
      });

      expect(mockAppendEvent).not.toHaveBeenCalled();
    });
  });

  describe('capture:shared', () => {
    it('appends capture:shared event to event stream', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCaptureHandlers } = await import('../../src/socket-handlers/capture-handlers.js');
      registerCaptureHandlers(socket as never, io as never);

      handlers.get('capture:shared')!();

      expect(mockAppendEvent).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'capture:shared',
          userId: 'user-1',
          ts: expect.any(Number),
          data: {},
        }),
      );
    });

    it('ignores capture:shared when sessionId is missing', async () => {
      const { socket, handlers } = createMockSocket();
      socket.data.sessionId = '';
      const { io } = createMockIo();

      const { registerCaptureHandlers } = await import('../../src/socket-handlers/capture-handlers.js');
      registerCaptureHandlers(socket as never, io as never);

      handlers.get('capture:shared')!();

      expect(mockAppendEvent).not.toHaveBeenCalled();
    });
  });
});
