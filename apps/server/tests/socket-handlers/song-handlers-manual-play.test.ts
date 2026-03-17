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

vi.mock('../../src/services/dj-state-store.js', () => ({
  getSessionDjState: vi.fn(),
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

const mockHandleManualSongPlay = vi.fn();
vi.mock('../../src/services/session-manager.js', () => ({
  handleQuickPickSongSelected: vi.fn(),
  recordParticipationAction: vi.fn(),
  getSongSelectionMode: vi.fn(),
  handleModeChange: vi.fn(),
  handleSpinAnimationComplete: vi.fn(),
  handleManualSongPlay: (...args: unknown[]) => mockHandleManualSongPlay(...args),
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
  broadcastSpinWheelStarted: vi.fn(),
  broadcastSpinWheelResult: vi.fn(),
  broadcastModeChanged: vi.fn(),
  getIO: vi.fn(),
}));

vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: vi.fn(),
}));

vi.mock('../../src/services/song-pool.js', () => ({
  markSongSung: vi.fn(),
  clearPool: vi.fn(),
  resetAllPools: vi.fn(),
}));

vi.mock('../../src/services/spin-wheel.js', () => ({
  startRound: vi.fn(),
  initiateSpin: vi.fn(),
  onSpinComplete: vi.fn(),
  startVetoWindow: vi.fn(),
  handleVeto: vi.fn(),
  resolveRound: vi.fn(),
  autoSpin: vi.fn(),
  getRound: vi.fn(),
  clearRound: vi.fn(),
  resetAllRounds: vi.fn(),
}));

const mockValidateHost = vi.fn();
vi.mock('../../src/socket-handlers/host-handlers.js', () => ({
  validateHost: (...args: unknown[]) => mockValidateHost(...args),
  registerHostHandlers: vi.fn(),
}));

vi.mock('../../src/persistence/session-repository.js', () => ({
  findById: vi.fn(),
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
      emit: vi.fn(),
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

describe('song-handlers song:manualPlay', () => {
  const validPayload = {
    catalogTrackId: 'cat-1',
    songTitle: 'Bohemian Rhapsody',
    artist: 'Queen',
    youtubeVideoId: 'yt-vid-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateHost.mockResolvedValue(undefined);
    mockHandleManualSongPlay.mockResolvedValue(undefined);
  });

  it('host can emit song:manualPlay with valid payload', async () => {
    const { socket, handlers } = createMockSocket();
    const { io } = createMockIo();

    const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
    registerSongHandlers(socket as never, io as never);

    await handlers.get('song:manualPlay')!(validPayload);

    expect(mockValidateHost).toHaveBeenCalledWith(socket);
    expect(mockHandleManualSongPlay).toHaveBeenCalledWith('session-1', validPayload);
  });

  it('non-host socket is rejected (host-only guard)', async () => {
    mockValidateHost.mockRejectedValue(new Error('Not host'));

    const { socket, handlers } = createMockSocket();
    const { io } = createMockIo();

    const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
    registerSongHandlers(socket as never, io as never);

    // Should not throw — error is caught internally
    await handlers.get('song:manualPlay')!(validPayload);

    expect(mockHandleManualSongPlay).not.toHaveBeenCalled();
  });

  it('invalid payload is rejected (Zod validation)', async () => {
    const { socket, handlers } = createMockSocket();
    const { io } = createMockIo();

    const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
    registerSongHandlers(socket as never, io as never);

    // Missing required fields
    await handlers.get('song:manualPlay')!({ catalogTrackId: 'cat-1' });

    expect(mockHandleManualSongPlay).not.toHaveBeenCalled();
  });

  it('registers the song:manualPlay handler', async () => {
    const { socket, handlers } = createMockSocket();
    const { io } = createMockIo();

    const { registerSongHandlers } = await import('../../src/socket-handlers/song-handlers.js');
    registerSongHandlers(socket as never, io as never);

    expect(handlers.has('song:manualPlay')).toBe(true);
  });
});
