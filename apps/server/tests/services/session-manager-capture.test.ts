import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
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

const mockFindById = vi.fn();
vi.mock('../../src/persistence/session-repository.js', () => ({
  create: vi.fn(),
  addParticipant: vi.fn(),
  addParticipantIfNotExists: vi.fn(),
  getParticipants: vi.fn().mockResolvedValue([]),
  findById: (...args: unknown[]) => mockFindById(...args),
  updateStatus: vi.fn(),
  updateHost: vi.fn(),
  updateDjState: vi.fn(),
  removeParticipant: vi.fn(),
  writeEventStream: vi.fn(),
  incrementParticipationScore: vi.fn().mockResolvedValue(undefined),
  getParticipantScore: vi.fn(),
  updateTopAward: vi.fn().mockResolvedValue(undefined),
  findActiveSessions: vi.fn(),
  persistSessionSummary: vi.fn().mockResolvedValue(undefined),
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
  broadcastFinaleStats: vi.fn(),
  broadcastFinaleSetlist: vi.fn(),
  broadcastFinaleAwards: vi.fn(),
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

vi.mock('../../src/services/song-pool.js', () => ({
  markSongSung: vi.fn(),
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
  flushEventStream: vi.fn().mockReturnValue([]),
  getEventStream: vi.fn().mockReturnValue([]),
  removeEventStream: vi.fn(),
}));

vi.mock('../../src/services/activity-tracker.js', () => ({ removeSession: vi.fn() }));
vi.mock('../../src/socket-handlers/connection-handler.js', () => ({
  clearSessionTimers: vi.fn(),
}));
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

const mockShouldEmitCaptureBubble = vi.fn();
const mockMarkBubbleEmitted = vi.fn();
const mockClearCaptureTriggerState = vi.fn();
vi.mock('../../src/services/capture-trigger.js', () => ({
  shouldEmitCaptureBubble: (...args: unknown[]) => mockShouldEmitCaptureBubble(...args),
  markBubbleEmitted: (...args: unknown[]) => mockMarkBubbleEmitted(...args),
  clearCaptureTriggerState: (...args: unknown[]) => mockClearCaptureTriggerState(...args),
}));

vi.mock('../../src/services/session-summary-builder.js', () => ({
  buildSessionSummary: vi.fn().mockReturnValue({ version: 1, generatedAt: 0, stats: {}, setlist: [], awards: [], participants: [] }),
}));

vi.mock('../../src/services/retry.js', () => ({
  withRetry: vi.fn().mockImplementation((fn: () => Promise<unknown>) => fn()),
}));

vi.mock('../../src/services/session-summary-fallback.js', () => ({
  writeSessionSummaryToDisk: vi.fn().mockResolvedValue(undefined),
}));

import { processTransition } from '../../src/dj-engine/machine.js';
import { processDjTransition, endSession, finalizeSession } from '../../src/services/session-manager.js';

describe('session-manager capture bubble triggers', () => {
  const mockEmit = vi.fn();
  const mockTo = vi.fn(() => ({ emit: mockEmit }));

  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    mockGetIO.mockReturnValue({ to: mockTo });
    mockShouldEmitCaptureBubble.mockReturnValue(true);
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits capture:bubble with session_start on icebreaker→songSelection after 10s delay', async () => {
    const oldContext = createTestDJContext({ state: DJState.icebreaker });
    const newContext = createTestDJContext({ state: DJState.songSelection });

    vi.mocked(processTransition).mockReturnValue({
      newContext,
      sideEffects: [{ type: 'broadcast', data: { from: DJState.icebreaker, to: DJState.songSelection } }],
    });

    await processDjTransition('session-1', oldContext, { type: 'ICEBREAKER_DONE' });

    // Should NOT emit immediately
    expect(mockEmit).not.toHaveBeenCalledWith('capture:bubble', expect.anything());

    // Advance past 10s delay
    vi.advanceTimersByTime(10_000);

    expect(mockShouldEmitCaptureBubble).toHaveBeenCalledWith('session-1', DJState.songSelection);
    expect(mockMarkBubbleEmitted).toHaveBeenCalledWith('session-1');
    expect(mockTo).toHaveBeenCalledWith('session-1');
    expect(mockEmit).toHaveBeenCalledWith('capture:bubble', expect.objectContaining({
      triggerType: 'session_start',
    }));
  });

  it('appends capture:bubble event to event stream on session start', async () => {
    const oldContext = createTestDJContext({ state: DJState.icebreaker });
    const newContext = createTestDJContext({ state: DJState.songSelection });

    vi.mocked(processTransition).mockReturnValue({
      newContext,
      sideEffects: [{ type: 'broadcast', data: { from: DJState.icebreaker, to: DJState.songSelection } }],
    });

    await processDjTransition('session-1', oldContext, { type: 'ICEBREAKER_DONE' });
    vi.advanceTimersByTime(10_000);

    expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
      type: 'capture:bubble',
      data: { triggerType: 'session_start' },
    }));
  });

  it('emits capture:bubble with session_end when entering finale', async () => {
    const oldContext = createTestDJContext({ state: DJState.song });
    const newContext = createTestDJContext({ state: DJState.finale });

    vi.mocked(processTransition).mockReturnValue({
      newContext,
      sideEffects: [{ type: 'broadcast', data: { from: DJState.song, to: DJState.finale } }],
    });

    await processDjTransition('session-1', oldContext, { type: 'END_PARTY' });

    expect(mockShouldEmitCaptureBubble).toHaveBeenCalledWith('session-1', DJState.finale);
    expect(mockMarkBubbleEmitted).toHaveBeenCalledWith('session-1');
    expect(mockEmit).toHaveBeenCalledWith('capture:bubble', expect.objectContaining({
      triggerType: 'session_end',
    }));
  });

  it('does not emit capture:bubble when shouldEmitCaptureBubble returns false', async () => {
    mockShouldEmitCaptureBubble.mockReturnValue(false);

    const oldContext = createTestDJContext({ state: DJState.song });
    const newContext = createTestDJContext({ state: DJState.finale });

    vi.mocked(processTransition).mockReturnValue({
      newContext,
      sideEffects: [{ type: 'broadcast', data: { from: DJState.song, to: DJState.finale } }],
    });

    await processDjTransition('session-1', oldContext, { type: 'END_PARTY' });

    expect(mockEmit).not.toHaveBeenCalledWith('capture:bubble', expect.anything());
    expect(mockMarkBubbleEmitted).not.toHaveBeenCalled();
  });

  it('appends capture:bubble event to event stream on session end', async () => {
    const oldContext = createTestDJContext({ state: DJState.song });
    const newContext = createTestDJContext({ state: DJState.finale });

    vi.mocked(processTransition).mockReturnValue({
      newContext,
      sideEffects: [{ type: 'broadcast', data: { from: DJState.song, to: DJState.finale } }],
    });

    await processDjTransition('session-1', oldContext, { type: 'END_PARTY' });

    expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
      type: 'capture:bubble',
      data: { triggerType: 'session_end' },
    }));
  });

  it('emits capture:bubble with post_ceremony after quick ceremony + 3s delay', async () => {
    const oldContext = createTestDJContext({ state: DJState.song });
    const newContext = createTestDJContext({
      state: DJState.ceremony,
      metadata: { ceremonyType: 'quick', lastCeremonyType: 'quick' },
    });

    vi.mocked(processTransition).mockReturnValue({
      newContext,
      sideEffects: [],
    });

    // Return a non-ceremony state when capture bubble checks DJ state after delay
    mockGetSessionDjState.mockReturnValue({ state: DJState.songSelection });

    await processDjTransition('session-1', oldContext, { type: 'SONG_ENDED' });

    // Quick ceremony fires immediately, then capture bubble after 3s
    vi.advanceTimersByTime(3000);

    expect(mockShouldEmitCaptureBubble).toHaveBeenCalledWith('session-1', DJState.songSelection);
    expect(mockMarkBubbleEmitted).toHaveBeenCalledWith('session-1');
    expect(mockEmit).toHaveBeenCalledWith('capture:bubble', expect.objectContaining({
      triggerType: 'post_ceremony',
    }));
    expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
      type: 'capture:bubble',
      data: { triggerType: 'post_ceremony' },
    }));
  });

  it('emits capture:bubble with post_ceremony after full ceremony reveal + 3s delay', async () => {
    const oldContext = createTestDJContext({ state: DJState.song });
    const newContext = createTestDJContext({
      state: DJState.ceremony,
      currentPerformer: null,
      metadata: { ceremonyType: 'full', lastCeremonyType: 'full' },
    });

    vi.mocked(processTransition).mockReturnValue({
      newContext,
      sideEffects: [],
    });

    // Return a non-ceremony state when capture bubble checks DJ state after delay
    mockGetSessionDjState.mockReturnValue({ state: DJState.songSelection });

    await processDjTransition('session-1', oldContext, { type: 'SONG_ENDED' });

    // Full ceremony: 2000ms anticipation + 3000ms capture delay = 5000ms
    vi.advanceTimersByTime(5000);

    expect(mockShouldEmitCaptureBubble).toHaveBeenCalledWith('session-1', DJState.songSelection);
    expect(mockEmit).toHaveBeenCalledWith('capture:bubble', expect.objectContaining({
      triggerType: 'post_ceremony',
    }));
  });

  it('calls clearCaptureTriggerState on session end', async () => {
    const context = createTestDJContext({ state: DJState.song, sessionId: 'session-1' });
    const finaleContext = createTestDJContext({ state: DJState.finale, sessionId: 'session-1' });

    mockFindById.mockResolvedValue({ id: 'session-1', host_user_id: 'host-1' });
    mockGetSessionDjState.mockReturnValue(context);
    vi.mocked(processTransition).mockReturnValue({
      newContext: finaleContext,
      sideEffects: [{ type: 'broadcast', data: { from: DJState.song, to: DJState.finale } }],
    });

    await endSession('session-1', 'host-1');
    await finalizeSession('session-1');

    expect(mockClearCaptureTriggerState).toHaveBeenCalledWith('session-1');
  });

  it('does not emit session_start bubble for non-lobby→songSelection transitions', async () => {
    const oldContext = createTestDJContext({ state: DJState.ceremony });
    const newContext = createTestDJContext({ state: DJState.songSelection });

    vi.mocked(processTransition).mockReturnValue({
      newContext,
      sideEffects: [{ type: 'broadcast', data: { from: DJState.ceremony, to: DJState.songSelection } }],
    });

    await processDjTransition('session-1', oldContext, { type: 'CEREMONY_DONE' });
    vi.advanceTimersByTime(5000);

    // Should not have called shouldEmitCaptureBubble for session_start
    // (it may be called for other triggers, but not the session_start setTimeout path)
    expect(mockEmit).not.toHaveBeenCalledWith('capture:bubble', expect.objectContaining({
      triggerType: 'session_start',
    }));
  });
});
