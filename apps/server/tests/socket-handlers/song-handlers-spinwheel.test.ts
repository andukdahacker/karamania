import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDJContext } from '../factories/dj-state.js';
import type { SpinWheelSegment } from '../../src/services/spin-wheel.js';

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

const mockGetSessionDjState = vi.fn();
vi.mock('../../src/services/dj-state-store.js', () => ({
  getSessionDjState: (...args: unknown[]) => mockGetSessionDjState(...args),
  setSessionDjState: vi.fn(),
  removeSessionDjState: vi.fn(),
}));

vi.mock('../../src/services/quick-pick.js', () => ({
  recordVote: vi.fn(),
  getRound: vi.fn(),
  startRound: vi.fn(),
  clearRound: vi.fn(),
  resolveByTimeout: vi.fn(),
  resetAllRounds: vi.fn(),
}));

const mockHandleQuickPickSongSelected = vi.fn();
const mockRecordParticipationAction = vi.fn();
const mockGetSongSelectionMode = vi.fn();
const mockHandleModeChange = vi.fn();
const mockHandleSpinAnimationComplete = vi.fn();
vi.mock('../../src/services/session-manager.js', () => ({
  handleQuickPickSongSelected: (...args: unknown[]) => mockHandleQuickPickSongSelected(...args),
  recordParticipationAction: (...args: unknown[]) => mockRecordParticipationAction(...args),
  getSongSelectionMode: (...args: unknown[]) => mockGetSongSelectionMode(...args),
  handleModeChange: (...args: unknown[]) => mockHandleModeChange(...args),
  handleSpinAnimationComplete: (...args: unknown[]) => mockHandleSpinAnimationComplete(...args),
  persistDjState: vi.fn(),
}));

const mockCancelSessionTimer = vi.fn();
vi.mock('../../src/services/timer-scheduler.js', () => ({
  scheduleSessionTimer: vi.fn(),
  cancelSessionTimer: (...args: unknown[]) => mockCancelSessionTimer(...args),
  pauseSessionTimer: vi.fn(),
  resumeSessionTimer: vi.fn(),
}));

const mockBroadcastSpinWheelResult = vi.fn();
vi.mock('../../src/services/dj-broadcaster.js', () => ({
  broadcastDjState: vi.fn(),
  broadcastDjPause: vi.fn(),
  broadcastDjResume: vi.fn(),
  broadcastQuickPickStarted: vi.fn(),
  broadcastSpinWheelResult: (...args: unknown[]) => mockBroadcastSpinWheelResult(...args),
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

const mockInitiateSpin = vi.fn();
const mockGetSpinWheelRound = vi.fn();
const mockHandleVeto = vi.fn();
vi.mock('../../src/services/spin-wheel.js', () => ({
  initiateSpin: (...args: unknown[]) => mockInitiateSpin(...args),
  getRound: (...args: unknown[]) => mockGetSpinWheelRound(...args),
  handleVeto: (...args: unknown[]) => mockHandleVeto(...args),
  startRound: vi.fn(),
  onSpinComplete: vi.fn(),
  startVetoWindow: vi.fn(),
  resolveRound: vi.fn(),
  autoSpin: vi.fn(),
  clearRound: vi.fn(),
  resetAllRounds: vi.fn(),
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

const testSpinWheelRound = {
  sessionId: 'session-1',
  segments: Array.from({ length: 8 }, (_, i) => ({
    catalogTrackId: `song-${i}`,
    songTitle: `Song ${i}`,
    artist: `Artist ${i}`,
    youtubeVideoId: `yt_${i}`,
    overlapCount: 1,
    segmentIndex: i,
  })),
  state: 'waiting' as const,
  spinnerUserId: null,
  targetSegmentIndex: null,
  vetoUsed: false,
  vetoedSegmentIndex: null,
  startedAt: Date.now(),
  spinTimerHandle: null,
  vetoTimerHandle: null,
};

describe('song-handlers spin wheel', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.useFakeTimers();
    mockRecordParticipationAction.mockResolvedValue(undefined);
    mockHandleModeChange.mockResolvedValue(undefined);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('song:spinwheel - spin action', () => {
    it('succeeds when DJ state is songSelection and mode is spinWheel', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetSongSelectionMode.mockReturnValue('spinWheel');
      mockGetSpinWheelRound.mockReturnValue({ ...testSpinWheelRound });
      mockInitiateSpin.mockReturnValue({
        targetSegmentIndex: 3,
        totalRotationRadians: 40,
        spinDurationMs: 4000,
      });

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:spinwheel')!({ action: 'spin' });

      expect(mockInitiateSpin).toHaveBeenCalledWith('session-1', 'user-1');
    });

    it('is rejected when mode is quickPick', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetSongSelectionMode.mockReturnValue('quickPick');

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:spinwheel')!({ action: 'spin' });

      expect(mockInitiateSpin).not.toHaveBeenCalled();
    });

    it('is rejected when DJ state is NOT songSelection', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'song' as const });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:spinwheel')!({ action: 'spin' });

      expect(mockInitiateSpin).not.toHaveBeenCalled();
    });

    it('returns silently when already spinning (initiateSpin returns null)', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetSongSelectionMode.mockReturnValue('spinWheel');
      mockGetSpinWheelRound.mockReturnValue({ ...testSpinWheelRound, state: 'spinning' });
      mockInitiateSpin.mockReturnValue(null);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:spinwheel')!({ action: 'spin' });

      expect(mockBroadcastSpinWheelResult).not.toHaveBeenCalled();
    });

    it('cancels DJ engine timer on spin', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetSongSelectionMode.mockReturnValue('spinWheel');
      mockGetSpinWheelRound.mockReturnValue({ ...testSpinWheelRound });
      mockInitiateSpin.mockReturnValue({
        targetSegmentIndex: 3,
        totalRotationRadians: 40,
        spinDurationMs: 4000,
      });

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:spinwheel')!({ action: 'spin' });

      expect(mockCancelSessionTimer).toHaveBeenCalledWith('session-1');
    });

    it('broadcasts spinwheel:result with spinning phase', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetSongSelectionMode.mockReturnValue('spinWheel');
      mockGetSpinWheelRound.mockReturnValue({ ...testSpinWheelRound });
      mockInitiateSpin.mockReturnValue({
        targetSegmentIndex: 3,
        totalRotationRadians: 40,
        spinDurationMs: 4000,
      });

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:spinwheel')!({ action: 'spin' });

      expect(mockBroadcastSpinWheelResult).toHaveBeenCalledWith('session-1', expect.objectContaining({
        phase: 'spinning',
        spinnerUserId: 'user-1',
        spinnerDisplayName: 'Test User',
        targetSegmentIndex: 3,
        totalRotationRadians: 40,
        spinDurationMs: 4000,
      }));
    });

    it('records participation action on spin', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetSongSelectionMode.mockReturnValue('spinWheel');
      mockGetSpinWheelRound.mockReturnValue({ ...testSpinWheelRound });
      mockInitiateSpin.mockReturnValue({
        targetSegmentIndex: 3,
        totalRotationRadians: 40,
        spinDurationMs: 4000,
      });

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:spinwheel')!({ action: 'spin' });

      expect(mockRecordParticipationAction).toHaveBeenCalledWith('session-1', 'user-1', 'spinwheel:spin', 2);
    });

    it('appends event on spin', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetSongSelectionMode.mockReturnValue('spinWheel');
      mockGetSpinWheelRound.mockReturnValue({ ...testSpinWheelRound });
      mockInitiateSpin.mockReturnValue({
        targetSegmentIndex: 3,
        totalRotationRadians: 40,
        spinDurationMs: 4000,
      });

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:spinwheel')!({ action: 'spin' });

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'spinwheel:spin',
        userId: 'user-1',
      }));
    });
  });

  describe('song:spinwheel - veto action', () => {
    const vetoedSong: SpinWheelSegment = {
      catalogTrackId: 'song-3',
      songTitle: 'Song 3',
      artist: 'Artist 3',
      youtubeVideoId: 'yt_3',
      overlapCount: 1,
      segmentIndex: 3,
    };

    it('succeeds during vetoing phase', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetSongSelectionMode.mockReturnValue('spinWheel');
      const round = { ...testSpinWheelRound, state: 'vetoing' as const, vetoTimerHandle: setTimeout(() => {}, 5000) };
      mockGetSpinWheelRound.mockReturnValue(round);
      mockHandleVeto.mockReturnValue({
        newTargetSegmentIndex: 5,
        totalRotationRadians: 42,
        spinDurationMs: 4000,
        vetoedSong,
      });

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:spinwheel')!({ action: 'veto' });

      expect(mockHandleVeto).toHaveBeenCalledWith('session-1', 'user-1');
      expect(mockBroadcastSpinWheelResult).toHaveBeenCalledWith('session-1', expect.objectContaining({
        phase: 'vetoed',
        vetoUserId: 'user-1',
        vetoedSong,
        newTargetSegmentIndex: 5,
      }));
    });

    it('returns silently when veto already used (handleVeto returns null)', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetSongSelectionMode.mockReturnValue('spinWheel');
      mockGetSpinWheelRound.mockReturnValue({ ...testSpinWheelRound, state: 'vetoing', vetoUsed: true });
      mockHandleVeto.mockReturnValue(null);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:spinwheel')!({ action: 'veto' });

      expect(mockBroadcastSpinWheelResult).not.toHaveBeenCalled();
    });

    it('records participation action on veto', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetSongSelectionMode.mockReturnValue('spinWheel');
      mockGetSpinWheelRound.mockReturnValue({ ...testSpinWheelRound, state: 'vetoing', vetoTimerHandle: null });
      mockHandleVeto.mockReturnValue({
        newTargetSegmentIndex: 5,
        totalRotationRadians: 42,
        spinDurationMs: 4000,
        vetoedSong,
      });

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:spinwheel')!({ action: 'veto' });

      expect(mockRecordParticipationAction).toHaveBeenCalledWith('session-1', 'user-1', 'spinwheel:veto', 1);
    });

    it('appends event on veto', async () => {
      const context = createTestDJContext({ sessionId: 'session-1', state: 'songSelection' as const });
      mockGetSessionDjState.mockReturnValue(context);
      mockGetSongSelectionMode.mockReturnValue('spinWheel');
      mockGetSpinWheelRound.mockReturnValue({ ...testSpinWheelRound, state: 'vetoing', vetoTimerHandle: null });
      mockHandleVeto.mockReturnValue({
        newTargetSegmentIndex: 5,
        totalRotationRadians: 42,
        spinDurationMs: 4000,
        vetoedSong,
      });

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:spinwheel')!({ action: 'veto' });

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'spinwheel:veto',
        userId: 'user-1',
        data: { vetoedSong: 'Song 3' },
      }));
    });
  });

  describe('song:modeChanged', () => {
    it('calls handleModeChange with correct params', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:modeChanged')!({ mode: 'spinWheel' });

      expect(mockHandleModeChange).toHaveBeenCalledWith('session-1', 'spinWheel', 'user-1', 'Test User');
    });

    it('rejects invalid mode values', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:modeChanged')!({ mode: 'invalid' });

      expect(mockHandleModeChange).not.toHaveBeenCalled();
    });

    it('rejects invalid payload schema', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
      registerSongHandlers(socket as never, io as never);

      await handlers.get('song:modeChanged')!({ wrongField: true });

      expect(mockHandleModeChange).not.toHaveBeenCalled();
    });
  });
});

// Required import for afterEach
import { afterEach } from 'vitest';
