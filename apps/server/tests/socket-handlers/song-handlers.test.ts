import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDJContext } from '../factories/dj-state.js';
import type { QuickPickSong } from '../../src/services/quick-pick.js';

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
vi.mock('../../src/services/quick-pick.js', () => ({
  recordVote: (...args: unknown[]) => mockRecordVote(...args),
  getRound: (...args: unknown[]) => mockGetRound(...args),
  startRound: vi.fn(),
  clearRound: vi.fn(),
  resolveByTimeout: vi.fn(),
  resetAllRounds: vi.fn(),
}));

const mockHandleQuickPickSongSelected = vi.fn();
const mockRecordParticipationAction = vi.fn();
vi.mock('../../src/services/session-manager.js', () => ({
  handleQuickPickSongSelected: (...args: unknown[]) => mockHandleQuickPickSongSelected(...args),
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
  broadcastDjPause: vi.fn(),
  broadcastDjResume: vi.fn(),
  broadcastQuickPickStarted: vi.fn(),
  getIO: vi.fn(),
}));

const mockAppendEvent = vi.fn();
vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

vi.mock('../../src/services/song-pool.js', () => ({
  markSongSung: vi.fn(),
  clearPool: vi.fn(),
  resetAllPools: vi.fn(),
}));

function createMockSocket(overrides: Partial<{ userId: string; sessionId: string; displayName: string }> = {}) {
  const handlers = new Map<string, (data?: unknown) => Promise<void>>();

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

function createTestQuickPickRound(songs: QuickPickSong[]) {
  const votes = new Map<string, Map<string, 'up' | 'skip'>>();
  for (const song of songs) {
    votes.set(song.catalogTrackId, new Map());
  }
  return {
    sessionId: 'session-1',
    songs,
    votes,
    participantCount: 5,
    startedAt: Date.now(),
    resolved: false,
    winningSongId: null,
  };
}

const testSongs: QuickPickSong[] = [
  { catalogTrackId: 'song-1', songTitle: 'Song 1', artist: 'Artist 1', youtubeVideoId: 'yt_1', overlapCount: 3 },
  { catalogTrackId: 'song-2', songTitle: 'Song 2', artist: 'Artist 2', youtubeVideoId: 'yt_2', overlapCount: 2 },
];

describe('song-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('song:quickpick', () => {
    it('records vote when DJ state is songSelection', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetRound.mockReturnValue(createTestQuickPickRound(testSongs));
      mockRecordVote.mockReturnValue({ recorded: true, songVotes: { up: 1, skip: 0 }, winner: null });
      mockRecordParticipationAction.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io, emittedToRoom } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:quickpick')!({ catalogTrackId: 'song-1', vote: 'up' });

      expect(mockRecordVote).toHaveBeenCalledWith('session-1', 'user-1', 'song-1', 'up');
    });

    it('is rejected (silent return) when DJ state is NOT songSelection', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:quickpick')!({ catalogTrackId: 'song-1', vote: 'up' });

      expect(mockRecordVote).not.toHaveBeenCalled();
    });

    it('is rejected when round does not exist', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetRound.mockReturnValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:quickpick')!({ catalogTrackId: 'song-1', vote: 'up' });

      expect(mockRecordVote).not.toHaveBeenCalled();
    });

    it('is rejected when catalogTrackId is not in round', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetRound.mockReturnValue(createTestQuickPickRound(testSongs));

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:quickpick')!({ catalogTrackId: 'bad-song', vote: 'up' });

      expect(mockRecordVote).not.toHaveBeenCalled();
    });

    it('broadcasts vote with correct payload', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetRound.mockReturnValue(createTestQuickPickRound(testSongs));
      mockRecordVote.mockReturnValue({ recorded: true, songVotes: { up: 2, skip: 1 }, winner: null });
      mockRecordParticipationAction.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io, emittedToRoom } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:quickpick')!({ catalogTrackId: 'song-1', vote: 'up' });

      expect(emittedToRoom).toContainEqual({
        room: 'session-1',
        event: 'song:quickpick',
        data: {
          catalogTrackId: 'song-1',
          userId: 'user-1',
          displayName: 'Test User',
          vote: 'up',
          songVotes: { up: 2, skip: 1 },
        },
      });
    });

    it('triggers song selection when majority winner is returned', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetRound.mockReturnValue(createTestQuickPickRound(testSongs));
      const winnerSong = testSongs[0]!;
      mockRecordVote.mockReturnValue({ recorded: true, songVotes: { up: 3, skip: 0 }, winner: winnerSong });
      mockHandleQuickPickSongSelected.mockResolvedValue(undefined);
      mockRecordParticipationAction.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:quickpick')!({ catalogTrackId: 'song-1', vote: 'up' });

      expect(mockHandleQuickPickSongSelected).toHaveBeenCalledWith('session-1', winnerSong);
    });

    it('records participation action on vote', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetRound.mockReturnValue(createTestQuickPickRound(testSongs));
      mockRecordVote.mockReturnValue({ recorded: true, songVotes: { up: 1, skip: 0 }, winner: null });
      mockRecordParticipationAction.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:quickpick')!({ catalogTrackId: 'song-1', vote: 'up' });

      expect(mockRecordParticipationAction).toHaveBeenCalledWith('session-1', 'user-1', 'quickpick:vote', 1);
    });

    it('appends event to event stream on vote', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetRound.mockReturnValue(createTestQuickPickRound(testSongs));
      mockRecordVote.mockReturnValue({ recorded: true, songVotes: { up: 1, skip: 0 }, winner: null });
      mockRecordParticipationAction.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:quickpick')!({ catalogTrackId: 'song-1', vote: 'up' });

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'quickpick:vote',
        userId: 'user-1',
        data: { catalogTrackId: 'song-1', vote: 'up' },
      }));
    });
  });
});
