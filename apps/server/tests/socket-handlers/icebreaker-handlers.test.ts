import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDJContext } from '../factories/dj-state.js';

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

const mockGetSessionDjState = vi.fn();
vi.mock('../../src/services/dj-state-store.js', () => ({
  getSessionDjState: (...args: unknown[]) => mockGetSessionDjState(...args),
  setSessionDjState: vi.fn(),
  removeSessionDjState: vi.fn(),
}));

const mockRecordIcebreakerVote = vi.fn();
vi.mock('../../src/services/icebreaker-dealer.js', () => ({
  recordIcebreakerVote: (...args: unknown[]) => mockRecordIcebreakerVote(...args),
  dealQuestion: vi.fn(),
  startIcebreakerRound: vi.fn(),
  resolveIcebreaker: vi.fn(),
  clearSession: vi.fn(),
  resetAll: vi.fn(),
}));

const mockRecordParticipationAction = vi.fn();
vi.mock('../../src/services/session-manager.js', () => ({
  recordParticipationAction: (...args: unknown[]) => mockRecordParticipationAction(...args),
  persistDjState: vi.fn(),
}));

const mockAppendEvent = vi.fn();
vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

function createMockSocket(overrides: Partial<{ userId: string; sessionId: string; displayName: string }> = {}) {
  const handlers = new Map<string, (data?: unknown) => void>();

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
    },
    handlers,
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

describe('icebreaker-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('icebreaker:vote', () => {
    it('records vote when DJ state is icebreaker', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'icebreaker' as never });
      mockGetSessionDjState.mockReturnValue(context);
      mockRecordIcebreakerVote.mockReturnValue({ recorded: true, firstVote: true });
      mockRecordParticipationAction.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerIcebreakerHandlers } = await import('../../src/socket-handlers/icebreaker-handlers.js');
      registerIcebreakerHandlers(socket as never, io as never);

      const handler = handlers.get('icebreaker:vote')!;
      handler({ optionId: '80s' });

      expect(mockRecordIcebreakerVote).toHaveBeenCalledWith('session-1', 'user-1', '80s');
      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'icebreaker:vote',
        userId: 'user-1',
        data: { optionId: '80s' },
      }));
    });

    it('rejects invalid payload (missing optionId)', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'icebreaker' as never });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerIcebreakerHandlers } = await import('../../src/socket-handlers/icebreaker-handlers.js');
      registerIcebreakerHandlers(socket as never, io as never);

      const handler = handlers.get('icebreaker:vote')!;
      handler({ invalid: 'data' });

      expect(mockRecordIcebreakerVote).not.toHaveBeenCalled();
      expect(mockAppendEvent).not.toHaveBeenCalled();
    });

    it('rejects vote when DJ state is not icebreaker', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as never });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerIcebreakerHandlers } = await import('../../src/socket-handlers/icebreaker-handlers.js');
      registerIcebreakerHandlers(socket as never, io as never);

      const handler = handlers.get('icebreaker:vote')!;
      handler({ optionId: '80s' });

      expect(mockRecordIcebreakerVote).not.toHaveBeenCalled();
      expect(mockAppendEvent).not.toHaveBeenCalled();
    });

    it('rejects vote when session not found', async () => {
      mockGetSessionDjState.mockReturnValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerIcebreakerHandlers } = await import('../../src/socket-handlers/icebreaker-handlers.js');
      registerIcebreakerHandlers(socket as never, io as never);

      const handler = handlers.get('icebreaker:vote')!;
      handler({ optionId: '80s' });

      expect(mockRecordIcebreakerVote).not.toHaveBeenCalled();
      expect(mockAppendEvent).not.toHaveBeenCalled();
    });

    it('triggers participation scoring on first vote only', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'icebreaker' as never });
      mockGetSessionDjState.mockReturnValue(context);
      mockRecordParticipationAction.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerIcebreakerHandlers } = await import('../../src/socket-handlers/icebreaker-handlers.js');
      registerIcebreakerHandlers(socket as never, io as never);

      const handler = handlers.get('icebreaker:vote')!;

      // First vote — firstVote: true → should trigger participation scoring
      mockRecordIcebreakerVote.mockReturnValue({ recorded: true, firstVote: true });
      handler({ optionId: '80s' });

      expect(mockRecordParticipationAction).toHaveBeenCalledWith('session-1', 'user-1', 'icebreaker:vote', 1);

      vi.clearAllMocks();
      mockGetSessionDjState.mockReturnValue(context);

      // Subsequent vote — firstVote: false → should NOT trigger participation scoring
      mockRecordIcebreakerVote.mockReturnValue({ recorded: true, firstVote: false });
      handler({ optionId: '90s' });

      expect(mockRecordParticipationAction).not.toHaveBeenCalled();
      // Event stream should still be appended
      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'icebreaker:vote',
        data: { optionId: '90s' },
      }));
    });
  });
});
