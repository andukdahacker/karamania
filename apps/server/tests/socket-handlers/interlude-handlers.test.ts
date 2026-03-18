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

const mockRecordVote = vi.fn();
const mockGetRound = vi.fn();
vi.mock('../../src/services/activity-voter.js', () => ({
  recordVote: (...args: unknown[]) => mockRecordVote(...args),
  getRound: (...args: unknown[]) => mockGetRound(...args),
  startVoteRound: vi.fn(),
  clearSession: vi.fn(),
  resetAllRounds: vi.fn(),
  selectActivityOptions: vi.fn(),
  getVoteCounts: vi.fn(),
  resolveByTimeout: vi.fn(),
}));

const mockHandleInterludeVoteWinner = vi.fn();
const mockRecordParticipationAction = vi.fn();
vi.mock('../../src/services/session-manager.js', () => ({
  handleInterludeVoteWinner: (...args: unknown[]) => mockHandleInterludeVoteWinner(...args),
  recordParticipationAction: (...args: unknown[]) => mockRecordParticipationAction(...args),
  persistDjState: vi.fn(),
}));

vi.mock('../../src/services/timer-scheduler.js', () => ({
  scheduleSessionTimer: vi.fn(),
  cancelSessionTimer: vi.fn(),
  pauseSessionTimer: vi.fn(),
  resumeSessionTimer: vi.fn(),
}));

vi.mock('../../src/services/dj-broadcaster.js', () => ({
  broadcastDjState: vi.fn(),
  broadcastInterludeVoteStarted: vi.fn(),
  broadcastInterludeVoteResult: vi.fn(),
  getIO: vi.fn(),
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

describe('interlude-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('interlude:vote', () => {
    it('records vote when DJ state is interlude', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'interlude' as never });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetRound.mockReturnValue({ sessionId: 'session-1', options: [], votes: new Map(), resolved: false });
      mockRecordVote.mockReturnValue({ recorded: true, voteCounts: { kings_cup: 1 }, winner: null });
      mockRecordParticipationAction.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io, emittedToRoom } = createMockIo();

      const { registerInterludeHandlers } = await import('../../src/socket-handlers/interlude-handlers.js');
      registerInterludeHandlers(socket as never, io as never);

      const handler = handlers.get('interlude:vote')!;
      handler({ optionId: 'kings_cup' });

      expect(mockRecordVote).toHaveBeenCalledWith('session-1', 'user-1', 'kings_cup');
      expect(emittedToRoom).toHaveLength(1);
      expect(emittedToRoom[0]!.event).toBe('interlude:vote');
      expect(emittedToRoom[0]!.data).toEqual({
        optionId: 'kings_cup',
        userId: 'user-1',
        displayName: 'Test User',
        voteCounts: { kings_cup: 1 },
      });
    });

    it('rejects vote when DJ state is not interlude', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as never });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers } = createMockSocket();
      const { io, emittedToRoom } = createMockIo();

      const { registerInterludeHandlers } = await import('../../src/socket-handlers/interlude-handlers.js');
      registerInterludeHandlers(socket as never, io as never);

      const handler = handlers.get('interlude:vote')!;
      handler({ optionId: 'kings_cup' });

      expect(mockRecordVote).not.toHaveBeenCalled();
      expect(emittedToRoom).toHaveLength(0);
    });

    it('rejects invalid payload (missing optionId)', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'interlude' as never });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers } = createMockSocket();
      const { io, emittedToRoom } = createMockIo();

      const { registerInterludeHandlers } = await import('../../src/socket-handlers/interlude-handlers.js');
      registerInterludeHandlers(socket as never, io as never);

      const handler = handlers.get('interlude:vote')!;
      handler({ invalid: 'data' });

      expect(mockRecordVote).not.toHaveBeenCalled();
      expect(emittedToRoom).toHaveLength(0);
    });

    it('calls handleInterludeVoteWinner when majority reached', async () => {
      const winner = { id: 'kings_cup', name: 'Kings Cup', description: 'test', icon: '👑', universal: true, minParticipants: 3 };
      const context = createTestDJContext({ sessionId: 'session-1', state: 'interlude' as never });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetRound.mockReturnValue({ sessionId: 'session-1', options: [winner], votes: new Map(), resolved: false });
      mockRecordVote.mockReturnValue({ recorded: true, voteCounts: { kings_cup: 3 }, winner });
      mockRecordParticipationAction.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerInterludeHandlers } = await import('../../src/socket-handlers/interlude-handlers.js');
      registerInterludeHandlers(socket as never, io as never);

      const handler = handlers.get('interlude:vote')!;
      handler({ optionId: 'kings_cup' });

      expect(mockHandleInterludeVoteWinner).toHaveBeenCalledWith('session-1', winner);
    });

    it('logs event stream on successful vote', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'interlude' as never });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetRound.mockReturnValue({ sessionId: 'session-1', options: [], votes: new Map(), resolved: false });
      mockRecordVote.mockReturnValue({ recorded: true, voteCounts: { kings_cup: 1 }, winner: null });
      mockRecordParticipationAction.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerInterludeHandlers } = await import('../../src/socket-handlers/interlude-handlers.js');
      registerInterludeHandlers(socket as never, io as never);

      const handler = handlers.get('interlude:vote')!;
      handler({ optionId: 'kings_cup' });

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'interlude:vote',
        userId: 'user-1',
        data: { optionId: 'kings_cup' },
      }));
    });

    it('records participation scoring on successful vote', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'interlude' as never });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetRound.mockReturnValue({ sessionId: 'session-1', options: [], votes: new Map(), resolved: false });
      mockRecordVote.mockReturnValue({ recorded: true, voteCounts: { kings_cup: 1 }, winner: null });
      mockRecordParticipationAction.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerInterludeHandlers } = await import('../../src/socket-handlers/interlude-handlers.js');
      registerInterludeHandlers(socket as never, io as never);

      const handler = handlers.get('interlude:vote')!;
      handler({ optionId: 'kings_cup' });

      expect(mockRecordParticipationAction).toHaveBeenCalledWith('session-1', 'user-1', 'interlude:vote', 1);
    });

    it('does not broadcast when vote not recorded', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'interlude' as never });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetRound.mockReturnValue({ sessionId: 'session-1', options: [], votes: new Map(), resolved: true });
      mockRecordVote.mockReturnValue({ recorded: false, voteCounts: {}, winner: null });

      const { socket, handlers } = createMockSocket();
      const { io, emittedToRoom } = createMockIo();

      const { registerInterludeHandlers } = await import('../../src/socket-handlers/interlude-handlers.js');
      registerInterludeHandlers(socket as never, io as never);

      const handler = handlers.get('interlude:vote')!;
      handler({ optionId: 'kings_cup' });

      expect(emittedToRoom).toHaveLength(0);
    });
  });
});
