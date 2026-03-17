import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDJContext } from '../factories/dj-state.js';
import { DJState } from '../../src/dj-engine/types.js';

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
vi.mock('../../src/services/party-code.js', () => ({ generateUniquePartyCode: vi.fn() }));

vi.mock('../../src/persistence/session-repository.js', () => ({
  create: vi.fn(),
  addParticipant: vi.fn(),
  addParticipantIfNotExists: vi.fn(),
  getParticipants: vi.fn(),
  findById: vi.fn(),
  updateStatus: vi.fn(),
  updateHost: vi.fn(),
  updateDjState: vi.fn(),
  removeParticipant: vi.fn(),
  writeEventStream: vi.fn(),
  incrementParticipationScore: vi.fn().mockResolvedValue(undefined),
  getParticipantScore: vi.fn(),
  updateTopAward: vi.fn().mockResolvedValue(undefined),
  findActiveSessions: vi.fn(),
}));

vi.mock('../../src/dj-engine/machine.js', () => ({
  createDJContext: vi.fn(),
  processTransition: vi.fn(),
}));

vi.mock('../../src/dj-engine/serializer.js', () => ({
  deserializeDJContext: vi.fn(),
  serializeDJContext: (ctx: unknown) => ctx,
}));

const mockGetSessionDjState = vi.fn();
const mockSetSessionDjState = vi.fn();
vi.mock('../../src/services/dj-state-store.js', () => ({
  getSessionDjState: (...args: unknown[]) => mockGetSessionDjState(...args),
  setSessionDjState: (...args: unknown[]) => mockSetSessionDjState(...args),
  removeSessionDjState: vi.fn(),
}));

vi.mock('../../src/services/timer-scheduler.js', () => ({
  scheduleSessionTimer: vi.fn(),
  cancelSessionTimer: vi.fn(),
  pauseSessionTimer: vi.fn(),
  resumeSessionTimer: vi.fn(),
}));

const mockGetIO = vi.fn();
vi.mock('../../src/services/dj-broadcaster.js', () => ({
  broadcastDjState: vi.fn(),
  broadcastDjPause: vi.fn(),
  broadcastDjResume: vi.fn(),
  broadcastCeremonyAnticipation: vi.fn(),
  broadcastCeremonyReveal: vi.fn(),
  broadcastCeremonyQuick: vi.fn(),
  broadcastCardDealt: vi.fn(),
  broadcastQuickPickStarted: vi.fn(),
  broadcastSpinWheelStarted: vi.fn(),
  broadcastSpinWheelResult: vi.fn(),
  broadcastModeChanged: vi.fn(),
  getIO: (...args: unknown[]) => mockGetIO(...args),
}));

vi.mock('../../src/services/quick-pick.js', () => ({
  startRound: vi.fn(),
  getRound: vi.fn(),
  resolveByTimeout: vi.fn(),
  clearRound: vi.fn(),
  resetAllRounds: vi.fn(),
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

vi.mock('../../src/services/suggestion-engine.js', () => ({
  computeSuggestions: vi.fn(),
}));

const mockMarkSongSung = vi.fn();
vi.mock('../../src/services/song-pool.js', () => ({
  markSongSung: (...args: unknown[]) => mockMarkSongSung(...args),
  clearPool: vi.fn(),
  resetAllPools: vi.fn(),
}));

vi.mock('../../src/services/connection-tracker.js', () => ({
  removeSession: vi.fn(),
  getActiveConnections: vi.fn().mockReturnValue([]),
  trackConnection: vi.fn(),
  trackDisconnection: vi.fn(),
  isUserConnected: vi.fn(),
  getLongestConnected: vi.fn(),
  removeDisconnectedEntry: vi.fn(),
  updateHostStatus: vi.fn(),
  getActiveCount: vi.fn(),
}));

const mockAppendEvent = vi.fn();
vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
  flushEventStream: vi.fn(),
  getEventStream: vi.fn().mockReturnValue([]),
  removeEventStream: vi.fn(),
}));

vi.mock('../../src/services/activity-tracker.js', () => ({ removeSession: vi.fn() }));
vi.mock('../../src/services/streak-tracker.js', () => ({
  clearSessionStreaks: vi.fn(),
  clearUserStreak: vi.fn(),
  clearStreakStore: vi.fn(),
}));
vi.mock('../../src/services/card-dealer.js', () => ({
  dealCard: vi.fn(),
  clearDealtCards: vi.fn(),
}));
vi.mock('../../src/services/participation-scoring.js', () => ({
  calculateScoreIncrement: vi.fn(),
  ACTION_TIER_MAP: {},
}));
vi.mock('../../src/services/award-generator.js', () => ({
  generateAward: vi.fn(),
  AWARD_TEMPLATES: [],
  AwardTone: {},
}));

vi.mock('../../src/integrations/lounge-api.js', () => ({
  createLoungeApiClient: vi.fn(),
  resetForTest: vi.fn(),
}));

vi.mock('../../src/services/song-detection.js', () => ({
  detectSong: vi.fn(),
  resetDetectionCache: vi.fn(),
}));

import { handleManualSongPlay } from '../../src/services/session-manager.js';

describe('handleManualSongPlay', () => {
  const mockEmit = vi.fn();
  const mockTo = vi.fn(() => ({ emit: mockEmit }));

  const testSong = {
    catalogTrackId: 'cat-1',
    songTitle: 'Bohemian Rhapsody',
    artist: 'Queen',
    youtubeVideoId: 'yt-vid-123',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    mockGetIO.mockReturnValue({ to: mockTo });
  });

  it('updates DJContext with currentSongTitle and metadata', async () => {
    const context = createTestDJContext({ state: DJState.song });
    mockGetSessionDjState.mockReturnValue(context);

    await handleManualSongPlay('session-1', testSong);

    expect(mockSetSessionDjState).toHaveBeenCalledWith('session-1', expect.objectContaining({
      currentSongTitle: 'Bohemian Rhapsody',
      metadata: expect.objectContaining({
        manuallyMarkedSong: {
          catalogTrackId: 'cat-1',
          songTitle: 'Bohemian Rhapsody',
          artist: 'Queen',
          youtubeVideoId: 'yt-vid-123',
        },
      }),
    }));
  });

  it('emits SONG_DETECTED with source manual', async () => {
    const context = createTestDJContext({ state: DJState.song });
    mockGetSessionDjState.mockReturnValue(context);

    await handleManualSongPlay('session-1', testSong);

    expect(mockTo).toHaveBeenCalledWith('session-1');
    expect(mockEmit).toHaveBeenCalledWith('song:detected', {
      videoId: 'yt-vid-123',
      songTitle: 'Bohemian Rhapsody',
      artist: 'Queen',
      channel: null,
      thumbnail: null,
      source: 'manual',
    });
  });

  it('calls markSongSung for suggestion engine dedup', async () => {
    const context = createTestDJContext({ state: DJState.song });
    mockGetSessionDjState.mockReturnValue(context);

    await handleManualSongPlay('session-1', testSong);

    expect(mockMarkSongSung).toHaveBeenCalledWith('session-1', 'Bohemian Rhapsody', 'Queen');
  });

  it('appends song:manualPlay event to event stream', async () => {
    const context = createTestDJContext({ state: DJState.song });
    mockGetSessionDjState.mockReturnValue(context);

    await handleManualSongPlay('session-1', testSong);

    expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
      type: 'song:manualPlay',
      data: {
        videoId: 'yt-vid-123',
        title: 'Bohemian Rhapsody',
        artist: 'Queen',
      },
    }));
  });

  it('persists updated context via setSessionDjState', async () => {
    const context = createTestDJContext({ state: DJState.song });
    mockGetSessionDjState.mockReturnValue(context);

    await handleManualSongPlay('session-1', testSong);

    // serializeDJContext is mocked to pass-through, so setSessionDjState receives the updated context
    expect(mockSetSessionDjState).toHaveBeenCalledTimes(1);
    const updatedContext = mockSetSessionDjState.mock.calls[0]![1];
    expect(updatedContext.currentSongTitle).toBe('Bohemian Rhapsody');
  });

  it('returns early for non-existent session (no crash)', async () => {
    mockGetSessionDjState.mockReturnValue(undefined);

    await handleManualSongPlay('nonexistent', testSong);

    expect(mockSetSessionDjState).not.toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
    expect(mockMarkSongSung).not.toHaveBeenCalled();
    expect(mockAppendEvent).not.toHaveBeenCalled();
  });

  it('does not emit when getIO returns null', async () => {
    const context = createTestDJContext({ state: DJState.song });
    mockGetSessionDjState.mockReturnValue(context);
    mockGetIO.mockReturnValue(null);

    await handleManualSongPlay('session-1', testSong);

    // Should still update state and mark song sung, just no emit
    expect(mockSetSessionDjState).toHaveBeenCalled();
    expect(mockMarkSongSung).toHaveBeenCalled();
    expect(mockEmit).not.toHaveBeenCalled();
  });
});
