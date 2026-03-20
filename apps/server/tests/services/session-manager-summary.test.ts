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

vi.mock('../../src/services/party-code.js', () => ({
  generateUniquePartyCode: vi.fn(),
}));

const mockPersistSessionSummary = vi.fn();
const mockWriteEventStream = vi.fn().mockResolvedValue(undefined);
const mockFindById = vi.fn();
const mockGetParticipants = vi.fn();
const mockUpdateTopAward = vi.fn().mockResolvedValue(undefined);
vi.mock('../../src/persistence/session-repository.js', () => ({
  create: vi.fn(),
  addParticipant: vi.fn(),
  addParticipantIfNotExists: vi.fn(),
  getParticipants: (...args: unknown[]) => mockGetParticipants(...args),
  findById: (...args: unknown[]) => mockFindById(...args),
  updateStatus: vi.fn().mockResolvedValue(undefined),
  updateHost: vi.fn(),
  updateDjState: vi.fn().mockResolvedValue(undefined),
  removeParticipant: vi.fn(),
  writeEventStream: (...args: unknown[]) => mockWriteEventStream(...args),
  incrementParticipationScore: vi.fn().mockResolvedValue(undefined),
  getParticipantScore: vi.fn(),
  updateTopAward: (...args: unknown[]) => mockUpdateTopAward(...args),
  updateFeedbackScore: vi.fn().mockResolvedValue(undefined),
  findActiveSessions: vi.fn(),
  persistSessionSummary: (...args: unknown[]) => mockPersistSessionSummary(...args),
}));

const mockProcessTransition = vi.fn();
vi.mock('../../src/dj-engine/machine.js', () => ({
  createDJContext: vi.fn(),
  processTransition: mockProcessTransition,
}));

vi.mock('../../src/dj-engine/serializer.js', () => ({
  deserializeDJContext: vi.fn(),
  serializeDJContext: (ctx: unknown) => ctx,
}));

vi.mock('../../src/dj-engine/timers.js', () => ({
  calculateRemainingMs: vi.fn(),
}));

vi.mock('../../src/services/dj-state-store.js', () => {
  const store = new Map();
  return {
    getSessionDjState: (id: string) => store.get(id),
    setSessionDjState: (id: string, ctx: unknown) => store.set(id, ctx),
    removeSessionDjState: (id: string) => store.delete(id),
  };
});

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
  broadcastCeremonyAnticipation: vi.fn(),
  broadcastCeremonyReveal: vi.fn(),
  broadcastCeremonyQuick: vi.fn(),
  broadcastCardDealt: vi.fn(),
  broadcastQuickPickStarted: vi.fn(),
  broadcastSpinWheelStarted: vi.fn(),
  broadcastSpinWheelResult: vi.fn(),
  broadcastModeChanged: vi.fn(),
  broadcastInterludeVoteStarted: vi.fn(),
  broadcastInterludeVoteResult: vi.fn(),
  broadcastInterludeGameStarted: vi.fn(),
  broadcastInterludeGameEnded: vi.fn(),
  broadcastQuickVoteResult: vi.fn(),
  broadcastIcebreakerStarted: vi.fn(),
  broadcastIcebreakerResult: vi.fn(),
  broadcastFinaleAwards: vi.fn(),
  broadcastFinaleStats: vi.fn(),
  broadcastFinaleSetlist: vi.fn(),
  getIO: vi.fn().mockReturnValue(null),
}));

vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: vi.fn(),
  flushEventStream: vi.fn().mockReturnValue([]),
  getEventStream: vi.fn().mockReturnValue([]),
}));

vi.mock('../../src/services/connection-tracker.js', () => ({
  getActiveConnections: vi.fn().mockReturnValue([]),
  removeSession: vi.fn(),
}));

vi.mock('../../src/socket-handlers/connection-handler.js', () => ({
  clearSessionTimers: vi.fn(),
}));

vi.mock('../../src/socket-handlers/finale-handlers.js', () => ({
  clearFeedbackTracking: vi.fn(),
}));

vi.mock('../../src/services/activity-tracker.js', () => ({
  removeSession: vi.fn(),
}));

vi.mock('../../src/services/participation-scoring.js', () => ({
  calculateScoreIncrement: vi.fn(),
  ACTION_TIER_MAP: {},
}));

vi.mock('../../src/services/award-generator.js', () => ({
  generateAward: vi.fn(),
  AWARD_TEMPLATES: [],
  AwardTone: { comedic: 'comedic', hype: 'hype', absurd: 'absurd', wholesome: 'wholesome' },
}));

vi.mock('../../src/services/streak-tracker.js', () => ({
  clearSessionStreaks: vi.fn(),
}));

vi.mock('../../src/services/peak-detector.js', () => ({
  clearSession: vi.fn(),
}));

vi.mock('../../src/services/activity-voter.js', () => ({
  selectActivityOptions: vi.fn(),
  startVoteRound: vi.fn(),
  resolveByTimeout: vi.fn(),
  getVoteCounts: vi.fn(),
  clearSession: vi.fn(),
}));

vi.mock('../../src/services/song-pool.js', () => ({
  clearPool: vi.fn(),
  markSongSung: vi.fn(),
}));

vi.mock('../../src/services/song-detection.js', () => ({
  detectSong: vi.fn(),
}));

vi.mock('../../src/services/quick-pick.js', () => ({
  startRound: vi.fn(),
  getRound: vi.fn(),
  resolveByTimeout: vi.fn(),
  clearRound: vi.fn(),
}));

vi.mock('../../src/services/suggestion-engine.js', () => ({
  computeSuggestions: vi.fn(),
}));

vi.mock('../../src/services/capture-trigger.js', () => ({
  shouldEmitCaptureBubble: vi.fn(),
  markBubbleEmitted: vi.fn(),
  clearCaptureTriggerState: vi.fn(),
}));

vi.mock('../../src/services/card-dealer.js', () => ({
  dealCard: vi.fn(),
  clearDealtCards: vi.fn(),
  getCardStats: vi.fn().mockReturnValue({ dealt: 0, accepted: 0 }),
}));

vi.mock('../../src/services/kings-cup-dealer.js', () => ({
  dealCard: vi.fn(),
  clearSession: vi.fn(),
}));

vi.mock('../../src/services/dare-pull-dealer.js', () => ({
  dealDare: vi.fn(),
  selectTarget: vi.fn(),
  clearSession: vi.fn(),
}));

vi.mock('../../src/services/quick-vote-dealer.js', () => ({
  dealQuestion: vi.fn(),
  startQuickVoteRound: vi.fn(),
  resolveQuickVote: vi.fn(),
  clearSession: vi.fn(),
}));

vi.mock('../../src/services/singalong-dealer.js', () => ({
  dealPrompt: vi.fn(),
  clearSession: vi.fn(),
}));

vi.mock('../../src/services/icebreaker-dealer.js', () => ({
  dealQuestion: vi.fn(),
  startIcebreakerRound: vi.fn(),
  resolveIcebreaker: vi.fn(),
  clearSession: vi.fn(),
}));

vi.mock('../../src/services/finale-award-generator.js', () => ({
  analyzeSessionForAwards: vi.fn().mockReturnValue([]),
  generateFinaleAwards: vi.fn().mockReturnValue([]),
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
}));

vi.mock('../../src/integrations/lounge-api.js', () => ({
  createLoungeApiClient: vi.fn(),
}));

const mockWriteSessionSummaryToDisk = vi.fn().mockResolvedValue(undefined);
vi.mock('../../src/services/session-summary-fallback.js', () => ({
  writeSessionSummaryToDisk: (...args: unknown[]) => mockWriteSessionSummaryToDisk(...args),
}));

import { createTestDJContext } from '../factories/dj-state.js';
import { DJState } from '../../src/dj-engine/types.js';

describe('writeSessionSummary (via initiateFinale)', () => {
  const sessionId = 'session-finale-test';
  const hostUserId = 'host-user-1';

  beforeEach(async () => {
    vi.clearAllMocks();

    // Set up DJ state in the store
    const { setSessionDjState } = await import('../../src/services/dj-state-store.js');
    const context = createTestDJContext({
      sessionId,
      state: DJState.song,
      songCount: 3,
      participantCount: 2,
      sessionStartedAt: Date.now() - 3600000,
    });
    setSessionDjState(sessionId, context);

    // Mock findById to return valid session
    mockFindById.mockResolvedValue({
      id: sessionId,
      host_user_id: hostUserId,
      status: 'active',
    });

    // Mock processTransition to succeed
    mockProcessTransition.mockReturnValue({
      newContext: createTestDJContext({ sessionId, state: DJState.finale }),
      sideEffects: [],
    });

    // Mock getParticipants
    mockGetParticipants.mockResolvedValue([
      { id: 'p1', user_id: 'user-1', guest_name: null, display_name: 'Alice', joined_at: new Date() },
      { id: 'p2', user_id: null, guest_name: 'Bob', display_name: null, joined_at: new Date() },
    ]);
  });

  it('builds and persists summary from in-memory data', async () => {
    mockPersistSessionSummary.mockResolvedValue(undefined);

    const { initiateFinale } = await import('../../src/services/session-manager.js');
    await initiateFinale(sessionId, hostUserId);

    // Allow fire-and-forget to resolve
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockPersistSessionSummary).toHaveBeenCalledTimes(1);
    const [calledSessionId, calledSummary] = mockPersistSessionSummary.mock.calls[0] as [string, unknown];
    expect(calledSessionId).toBe(sessionId);
    expect(calledSummary).toHaveProperty('version', 1);
    expect(calledSummary).toHaveProperty('generatedAt');
    expect(calledSummary).toHaveProperty('stats');
    expect(calledSummary).toHaveProperty('participants');
  });

  it('retries on DB failure and succeeds', async () => {
    vi.useFakeTimers();

    mockPersistSessionSummary
      .mockRejectedValueOnce(new Error('db timeout'))
      .mockResolvedValueOnce(undefined);

    const { initiateFinale } = await import('../../src/services/session-manager.js');
    await initiateFinale(sessionId, hostUserId);

    // Advance to allow retry delay
    await vi.advanceTimersByTimeAsync(5000);

    expect(mockPersistSessionSummary).toHaveBeenCalledTimes(2);
    expect(mockWriteSessionSummaryToDisk).not.toHaveBeenCalled();

    vi.useRealTimers();
  });

  it('falls back to disk on total DB failure', async () => {
    vi.useFakeTimers();

    mockPersistSessionSummary.mockRejectedValue(new Error('db down'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { initiateFinale } = await import('../../src/services/session-manager.js');
    await initiateFinale(sessionId, hostUserId);

    // Advance through all retry delays
    await vi.advanceTimersByTimeAsync(30000);

    expect(mockPersistSessionSummary).toHaveBeenCalledTimes(4); // maxAttempts = 4
    expect(mockWriteSessionSummaryToDisk).toHaveBeenCalledTimes(1);

    consoleSpy.mockRestore();
    vi.useRealTimers();
  });

  it('uses fallback defaults when stats/setlist computation failed', async () => {
    mockPersistSessionSummary.mockResolvedValue(undefined);

    // Mock event stream to throw so calculateSessionStats fails
    const eventStreamMock = await import('../../src/services/event-stream.js');
    vi.mocked(eventStreamMock.getEventStream).mockImplementation(() => { throw new Error('event stream error'); });
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { initiateFinale } = await import('../../src/services/session-manager.js');
    await initiateFinale(sessionId, hostUserId);

    // Allow fire-and-forget to resolve
    await new Promise(resolve => setTimeout(resolve, 50));

    expect(mockPersistSessionSummary).toHaveBeenCalledTimes(1);
    const [, calledSummary] = mockPersistSessionSummary.mock.calls[0] as [string, Record<string, unknown>];
    const stats = calledSummary.stats as Record<string, unknown>;
    // Should have fallback defaults since calculateSessionStats threw
    expect(stats.songCount).toBe(0);
    expect(stats.sessionDurationMs).toBe(0);
    expect(calledSummary.setlist).toEqual([]);

    consoleSpy.mockRestore();
    // Restore normal mock
    vi.mocked(eventStreamMock.getEventStream).mockReturnValue([]);
  });

  it('fire-and-forget — does not throw to caller', async () => {
    mockPersistSessionSummary.mockRejectedValue(new Error('db down'));
    mockWriteSessionSummaryToDisk.mockRejectedValue(new Error('disk full'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { initiateFinale } = await import('../../src/services/session-manager.js');

    // Should not throw even if both DB and disk fail
    await expect(initiateFinale(sessionId, hostUserId)).resolves.toBeDefined();

    consoleSpy.mockRestore();
  });
});
