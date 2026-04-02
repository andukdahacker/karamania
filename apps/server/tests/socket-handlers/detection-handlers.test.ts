import { describe, it, expect, vi, beforeEach } from 'vitest';

function createMockSocket(overrides: Partial<{ userId: string; sessionId: string; displayName: string }> = {}) {
  const handlers = new Map<string, (data?: unknown) => Promise<void>>();
  const emittedToSelf: Array<{ event: string; data: unknown }> = [];

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
      emit: (event: string, data: unknown) => {
        emittedToSelf.push({ event, data });
      },
    },
    handlers,
    emittedToSelf,
  };
}

function createMockIo() {
  const emittedToRoom: Array<{ room: string; event: string; data: unknown }> = [];

  return {
    io: {
      to: (target: string) => ({
        emit: (event: string, data: unknown) => {
          emittedToRoom.push({ room: target, event, data });
        },
      }),
    },
    emittedToRoom,
  };
}

describe('detection-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('detect:result handler', () => {
    it('registers detect:result event handler', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerDetectionHandlers } = await import('../../src/socket-handlers/detection-handlers.js');
      registerDetectionHandlers(socket as never, io as never);

      expect(handlers.has('detect:result')).toBe(true);
    });

    it('broadcasts detect:songChanged to session room on detect:result', async () => {
      const { socket, handlers } = createMockSocket({ sessionId: 'session-42', userId: 'user-7' });
      const { io, emittedToRoom } = createMockIo();

      const { registerDetectionHandlers } = await import('../../src/socket-handlers/detection-handlers.js');
      registerDetectionHandlers(socket as never, io as never);

      await handlers.get('detect:result')!({
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        isrc: 'GBUM71029604',
        timeOffsetMs: 45000,
        confidence: 95,
      });

      expect(emittedToRoom.length).toBeGreaterThanOrEqual(1);
      const lastEmit = emittedToRoom[emittedToRoom.length - 1]!;
      expect(lastEmit.room).toBe('session-42');
      expect(lastEmit.event).toBe('detect:songChanged');
      expect(lastEmit.data).toEqual({
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
        isrc: 'GBUM71029604',
        timeOffsetMs: 45000,
        confidence: 95,
        detectedBy: 'user-7',
      });
    });

    it('handles null isrc and timeOffsetMs', async () => {
      const { socket, handlers } = createMockSocket();
      const { io, emittedToRoom } = createMockIo();

      const { registerDetectionHandlers } = await import('../../src/socket-handlers/detection-handlers.js');
      registerDetectionHandlers(socket as never, io as never);

      await handlers.get('detect:result')!({
        title: 'Unknown Track',
        artist: 'Unknown Artist',
        confidence: 50,
      });

      expect(emittedToRoom.length).toBeGreaterThanOrEqual(1);
      const lastEmit = emittedToRoom[emittedToRoom.length - 1]!;
      expect(lastEmit.data).toEqual({
        title: 'Unknown Track',
        artist: 'Unknown Artist',
        isrc: null,
        timeOffsetMs: null,
        confidence: 50,
        detectedBy: 'user-1',
      });
    });

    it('rejects payload with missing required fields', async () => {
      const { socket, handlers } = createMockSocket();
      const { io, emittedToRoom } = createMockIo();

      const { registerDetectionHandlers } = await import('../../src/socket-handlers/detection-handlers.js');
      registerDetectionHandlers(socket as never, io as never);

      // Missing title
      await handlers.get('detect:result')!({ artist: 'Queen', confidence: 95 });
      expect(emittedToRoom.length).toBe(0);

      // Missing confidence
      await handlers.get('detect:result')!({ title: 'Song', artist: 'Artist' });
      expect(emittedToRoom.length).toBe(0);

      // Wrong type for confidence
      await handlers.get('detect:result')!({ title: 'Song', artist: 'Artist', confidence: 'high' });
      expect(emittedToRoom.length).toBe(0);
    });

    it('logs detection for PoC data collection', async () => {
      const consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});

      const { socket, handlers } = createMockSocket({ displayName: 'Alice' });
      const { io } = createMockIo();

      const { registerDetectionHandlers } = await import('../../src/socket-handlers/detection-handlers.js');
      registerDetectionHandlers(socket as never, io as never);

      await handlers.get('detect:result')!({
        title: 'Test Song',
        artist: 'Test Artist',
        confidence: 88,
      });

      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('Test Song'),
      );
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining('confidence: 88'),
      );

      consoleSpy.mockRestore();
    });
  });
});
