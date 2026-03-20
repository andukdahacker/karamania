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

vi.mock('../../src/db/connection.js', () => ({
  db: {},
}));

vi.mock('../../src/services/party-code.js', () => ({
  generateUniquePartyCode: vi.fn(),
}));

const mockUpdateDjState = vi.fn();
const mockWriteEventStream = vi.fn().mockResolvedValue(undefined);
const mockFindById = vi.fn();
const mockGetParticipants = vi.fn().mockResolvedValue([]);
const mockUpdateTopAward = vi.fn().mockResolvedValue(undefined);
const mockUpdateFeedbackScore = vi.fn().mockResolvedValue(undefined);
vi.mock('../../src/persistence/session-repository.js', () => ({
  create: vi.fn(),
  addParticipant: vi.fn(),
  addParticipantIfNotExists: vi.fn(),
  getParticipants: (...args: unknown[]) => mockGetParticipants(...args),
  findById: (...args: unknown[]) => mockFindById(...args),
  updateStatus: vi.fn().mockResolvedValue(undefined),
  updateHost: vi.fn(),
  updateDjState: mockUpdateDjState,
  removeParticipant: vi.fn(),
  writeEventStream: (...args: unknown[]) => mockWriteEventStream(...args),
  incrementParticipationScore: vi.fn().mockResolvedValue(undefined),
  getParticipantScore: vi.fn(),
  updateTopAward: (...args: unknown[]) => mockUpdateTopAward(...args),
  findActiveSessions: vi.fn(),
  updateFeedbackScore: (...args: unknown[]) => mockUpdateFeedbackScore(...args),
  persistSessionSummary: vi.fn().mockResolvedValue(undefined),
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

const mockSetSessionDjState = vi.fn();
const mockGetSessionDjState = vi.fn();
const mockRemoveSessionDjState = vi.fn();
vi.mock('../../src/services/dj-state-store.js', () => ({
  getSessionDjState: (...args: unknown[]) => mockGetSessionDjState(...args),
  setSessionDjState: (...args: unknown[]) => mockSetSessionDjState(...args),
  removeSessionDjState: (...args: unknown[]) => mockRemoveSessionDjState(...args),
}));

const mockCancelSessionTimer = vi.fn();
vi.mock('../../src/services/timer-scheduler.js', () => ({
  scheduleSessionTimer: vi.fn(),
  cancelSessionTimer: (...args: unknown[]) => mockCancelSessionTimer(...args),
  pauseSessionTimer: vi.fn(),
  resumeSessionTimer: vi.fn(),
}));

const mockEmit = vi.fn();
const mockTo = vi.fn().mockReturnValue({ emit: mockEmit });
const mockGetIO = vi.fn().mockReturnValue({ to: mockTo });
const mockBroadcastFinaleAwards = vi.fn();
const mockBroadcastFinaleStats = vi.fn();
const mockBroadcastFinaleSetlist = vi.fn();
vi.mock('../../src/services/dj-broadcaster.js', () => ({
  broadcastDjState: vi.fn(),
  broadcastDjPause: vi.fn(),
  broadcastDjResume: vi.fn(),
  broadcastCeremonyAnticipation: vi.fn(),
  broadcastCeremonyReveal: vi.fn(),
  broadcastCeremonyQuick: vi.fn(),
  broadcastInterludeVoteStarted: vi.fn(),
  broadcastInterludeVoteResult: vi.fn(),
  broadcastInterludeGameStarted: vi.fn(),
  broadcastInterludeGameEnded: vi.fn(),
  broadcastQuickVoteResult: vi.fn(),
  broadcastCardDealt: vi.fn(),
  broadcastQuickPickStarted: vi.fn(),
  broadcastSpinWheelStarted: vi.fn(),
  broadcastSpinWheelResult: vi.fn(),
  broadcastModeChanged: vi.fn(),
  broadcastIcebreakerStarted: vi.fn(),
  broadcastIcebreakerResult: vi.fn(),
  broadcastFinaleAwards: (...args: unknown[]) => mockBroadcastFinaleAwards(...args),
  broadcastFinaleStats: (...args: unknown[]) => mockBroadcastFinaleStats(...args),
  broadcastFinaleSetlist: (...args: unknown[]) => mockBroadcastFinaleSetlist(...args),
  getIO: (...args: unknown[]) => mockGetIO(...args),
}));

vi.mock('../../src/services/kings-cup-dealer.js', () => ({
  dealCard: vi.fn().mockReturnValue({ id: 'mock-card', title: 'Mock', rule: 'Mock rule', emoji: '🃏' }),
  clearSession: vi.fn(),
  resetAll: vi.fn(),
}));

vi.mock('../../src/services/dare-pull-dealer.js', () => ({
  dealDare: vi.fn().mockReturnValue({ id: 'mock-dare', title: 'Mock Dare', dare: 'Mock dare text', emoji: '🎯' }),
  selectTarget: vi.fn().mockReturnValue(null),
  clearSession: vi.fn(),
  resetAll: vi.fn(),
}));

vi.mock('../../src/services/quick-vote-dealer.js', () => ({
  dealQuestion: vi.fn().mockReturnValue({ id: 'mock-q', question: 'Mock?', optionA: 'A', optionB: 'B', emoji: '❓' }),
  startQuickVoteRound: vi.fn(),
  recordQuickVote: vi.fn().mockReturnValue({ recorded: true, firstVote: true }),
  resolveQuickVote: vi.fn(),
  clearSession: vi.fn(),
  resetAll: vi.fn(),
}));

vi.mock('../../src/services/singalong-dealer.js', () => ({
  dealPrompt: vi.fn().mockReturnValue({ id: 'mock-prompt', title: 'Mock', lyric: 'Mock lyric', emoji: '🎤' }),
  clearSession: vi.fn(),
  resetAll: vi.fn(),
}));

vi.mock('../../src/services/icebreaker-dealer.js', () => ({
  dealQuestion: vi.fn(),
  startIcebreakerRound: vi.fn(),
  resolveIcebreaker: vi.fn(),
  clearSession: vi.fn(),
  resetAll: vi.fn(),
}));

vi.mock('../../src/services/activity-voter.js', () => ({
  selectActivityOptions: vi.fn().mockReturnValue([]),
  startVoteRound: vi.fn(),
  resolveByTimeout: vi.fn(),
  getVoteCounts: vi.fn().mockReturnValue({}),
  clearSession: vi.fn(),
  resetAllRounds: vi.fn(),
}));

const mockGetActiveConnections = vi.fn().mockReturnValue([]);
vi.mock('../../src/services/connection-tracker.js', () => ({
  removeSession: vi.fn(),
  getActiveConnections: (...args: unknown[]) => mockGetActiveConnections(...args),
  trackConnection: vi.fn(),
  trackDisconnection: vi.fn(),
  isUserConnected: vi.fn(),
  getLongestConnected: vi.fn(),
  removeDisconnectedEntry: vi.fn(),
  updateHostStatus: vi.fn(),
  getActiveCount: vi.fn(),
}));

const mockAppendEvent = vi.fn();
const mockGetEventStream = vi.fn().mockReturnValue([]);
const mockFlushEventStream = vi.fn().mockReturnValue([]);
vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
  flushEventStream: (...args: unknown[]) => mockFlushEventStream(...args),
  getEventStream: (...args: unknown[]) => mockGetEventStream(...args),
  removeEventStream: vi.fn(),
}));

vi.mock('../../src/services/activity-tracker.js', () => ({
  removeSession: vi.fn(),
}));

vi.mock('../../src/services/participation-scoring.js', () => ({
  calculateScoreIncrement: vi.fn(),
  ACTION_TIER_MAP: {},
}));

vi.mock('../../src/services/award-generator.js', () => ({
  generateAward: vi.fn().mockReturnValue('Star'),
  AWARD_TEMPLATES: [],
  AwardTone: { comedic: 'comedic', hype: 'hype', absurd: 'absurd', wholesome: 'wholesome' },
  weightedRandomSelect: vi.fn().mockImplementation((items: Array<{ template: unknown }>) => items[0]),
}));

vi.mock('../../src/services/streak-tracker.js', () => ({
  clearSessionStreaks: vi.fn(),
}));

vi.mock('../../src/services/peak-detector.js', () => ({
  clearSession: vi.fn(),
}));

vi.mock('../../src/services/card-dealer.js', () => ({
  dealCard: vi.fn(),
  clearDealtCards: vi.fn(),
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
  computeSuggestions: vi.fn().mockResolvedValue([]),
}));

vi.mock('../../src/services/capture-trigger.js', () => ({
  shouldEmitCaptureBubble: vi.fn().mockReturnValue(false),
  markBubbleEmitted: vi.fn(),
  clearCaptureTriggerState: vi.fn(),
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

const mockClearSessionTimers = vi.fn();
vi.mock('../../src/socket-handlers/connection-handler.js', () => ({
  clearSessionTimers: (...args: unknown[]) => mockClearSessionTimers(...args),
}));

vi.mock('../../src/services/finale-award-generator.js', () => ({
  analyzeSessionForAwards: vi.fn().mockReturnValue({ topPerformers: [], categories: {} }),
  generateFinaleAwards: vi.fn().mockReturnValue([]),
  FinaleAwardCategory: {},
}));

const mockClearFeedbackTracking = vi.fn();
vi.mock('../../src/socket-handlers/finale-handlers.js', () => ({
  clearFeedbackTracking: (...args: unknown[]) => mockClearFeedbackTracking(...args),
  registerFinaleHandlers: vi.fn(),
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

const sessionId = 'finale-sequence-test';
const hostUserId = 'host-user';

function setupDefaultMocks(): void {
  mockFindById.mockResolvedValue({
    id: sessionId,
    host_user_id: hostUserId,
    status: 'active',
    vibe: 'general',
  });

  mockGetSessionDjState.mockReturnValue(
    createTestDJContext({
      sessionId,
      state: DJState.song,
      songCount: 3,
      participantCount: 4,
      sessionStartedAt: Date.now() - 600_000,
    }),
  );

  mockProcessTransition.mockReturnValue({
    newContext: createTestDJContext({
      sessionId,
      state: DJState.finale,
      songCount: 3,
      participantCount: 4,
    }),
    sideEffects: [],
  });

  mockGetParticipants.mockResolvedValue([]);
  mockWriteEventStream.mockResolvedValue(undefined);
  mockGetEventStream.mockReturnValue([]);
  mockGetActiveConnections.mockReturnValue([]);
}

describe('initiateFinale', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('party:ended is NOT emitted during initiateFinale', async () => {
    const { initiateFinale } = await import('../../src/services/session-manager.js');
    await initiateFinale(sessionId, hostUserId);

    // party:ended should NOT be emitted via io.to().emit() during initiateFinale
    // It is only emitted later during finalizeSession
    const partyEndedCalls = mockEmit.mock.calls.filter(
      (call: unknown[]) => call[0] === 'party:ended',
    );
    expect(partyEndedCalls).toHaveLength(0);
  });

  it('broadcasts finale:stats and finale:setlist', async () => {
    mockGetEventStream.mockReturnValue([
      { type: 'reaction:sent', ts: 1, userId: 'user-1', data: { emoji: '🎉', streak: 1 } },
      { type: 'dj:stateChanged', ts: 100, data: { from: 'songSelection', to: 'song', trigger: 'SONG_SELECTED' } },
      { type: 'song:detected', ts: 110, data: { videoId: 'v1', title: 'Test Song', artist: 'Test Artist' } },
    ]);

    const { initiateFinale } = await import('../../src/services/session-manager.js');
    await initiateFinale(sessionId, hostUserId);

    expect(mockBroadcastFinaleStats).toHaveBeenCalledTimes(1);
    expect(mockBroadcastFinaleStats).toHaveBeenCalledWith(sessionId, expect.any(Object));
    expect(mockBroadcastFinaleSetlist).toHaveBeenCalledTimes(1);
    expect(mockBroadcastFinaleSetlist).toHaveBeenCalledWith(sessionId, expect.any(Array));
  });

  it('starts finalization timer', async () => {
    const { initiateFinale } = await import('../../src/services/session-manager.js');
    await initiateFinale(sessionId, hostUserId);

    expect(vi.getTimerCount()).toBeGreaterThan(0);
  });

  it('flushes event stream to DB before starting timer', async () => {
    // Return non-empty array so writeEventStream is called
    mockFlushEventStream.mockReturnValue([
      { type: 'party:ended', ts: Date.now(), userId: hostUserId, data: {} },
    ]);

    const { initiateFinale } = await import('../../src/services/session-manager.js');
    await initiateFinale(sessionId, hostUserId);

    expect(mockFlushEventStream).toHaveBeenCalledWith(sessionId);
    expect(mockWriteEventStream).toHaveBeenCalledWith(sessionId, expect.any(Array));
  });
});

describe('finalizeSession', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.clearAllMocks();
    setupDefaultMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('emits party:ended to all clients', async () => {
    const { finalizeSession } = await import('../../src/services/session-manager.js');
    await finalizeSession(sessionId);

    expect(mockTo).toHaveBeenCalledWith(sessionId);
    expect(mockEmit).toHaveBeenCalledWith('party:ended', { reason: 'host_ended' });
  });

  it('cleans up in-memory state', async () => {
    const { finalizeSession } = await import('../../src/services/session-manager.js');
    await finalizeSession(sessionId);

    expect(mockRemoveSessionDjState).toHaveBeenCalledWith(sessionId);
    expect(mockCancelSessionTimer).toHaveBeenCalledWith(sessionId);
    expect(mockClearSessionTimers).toHaveBeenCalledWith(sessionId);
  });

  it('cancels finalization timer when called early (host dismiss)', async () => {
    const { initiateFinale, finalizeSession } = await import('../../src/services/session-manager.js');

    // initiateFinale starts a finalization timer
    await initiateFinale(sessionId, hostUserId);
    expect(vi.getTimerCount()).toBeGreaterThan(0);

    // finalizeSession called early (host dismiss) should cancel the timer
    await finalizeSession(sessionId);
    expect(vi.getTimerCount()).toBe(0);
  });

  it('clearFeedbackTracking is called during cleanup', async () => {
    const { finalizeSession } = await import('../../src/services/session-manager.js');
    await finalizeSession(sessionId);

    expect(mockClearFeedbackTracking).toHaveBeenCalledWith(sessionId);
  });
});
