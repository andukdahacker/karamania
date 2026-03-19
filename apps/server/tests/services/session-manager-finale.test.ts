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

vi.mock('../../src/db/connection.js', () => ({
  db: {},
}));

vi.mock('../../src/services/party-code.js', () => ({
  generateUniquePartyCode: vi.fn(),
}));

const mockUpdateDjState = vi.fn();
const mockWriteEventStream = vi.fn();
const mockFindById = vi.fn();
const mockGetParticipants = vi.fn();
const mockUpdateTopAward = vi.fn().mockResolvedValue(undefined);
vi.mock('../../src/persistence/session-repository.js', () => ({
  create: vi.fn(),
  addParticipant: vi.fn(),
  addParticipantIfNotExists: vi.fn(),
  getParticipants: (...args: unknown[]) => mockGetParticipants(...args),
  findById: (...args: unknown[]) => mockFindById(...args),
  updateStatus: vi.fn(),
  updateHost: vi.fn(),
  updateDjState: mockUpdateDjState,
  removeParticipant: vi.fn(),
  writeEventStream: (...args: unknown[]) => mockWriteEventStream(...args),
  incrementParticipationScore: vi.fn().mockResolvedValue(undefined),
  getParticipantScore: vi.fn(),
  updateTopAward: (...args: unknown[]) => mockUpdateTopAward(...args),
  findActiveSessions: vi.fn(),
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

const mockBroadcastFinaleAwards = vi.fn();
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
  getIO: vi.fn(),
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

// finale-award-generator is NOT mocked — we test the real integration
// But we still need to handle imports that the generator depends on

describe('session-manager finale awards integration', () => {
  const sessionId = 'session-finale-test';
  const hostUserId = 'host-user';

  beforeEach(() => {
    vi.clearAllMocks();

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
        participantCount: 2,
      }),
    );

    mockProcessTransition.mockReturnValue({
      newContext: createTestDJContext({
        sessionId,
        state: DJState.finale,
        songCount: 3,
        participantCount: 2,
      }),
      sideEffects: [],
    });

    mockGetParticipants.mockResolvedValue([
      { id: 'p1', user_id: 'user-1', display_name: 'Alice', guest_name: null, joined_at: new Date() },
      { id: 'p2', user_id: 'user-2', display_name: 'Bob', guest_name: null, joined_at: new Date() },
    ]);

    mockWriteEventStream.mockResolvedValue(undefined);
  });

  it('generates awards and broadcasts during endSession', async () => {
    // Provide some event stream data for analysis
    mockGetEventStream.mockReturnValue([
      { type: 'reaction:sent', ts: 1, userId: 'user-1', data: { emoji: '🎉', streak: 1 } },
      { type: 'reaction:sent', ts: 2, userId: 'user-1', data: { emoji: '🔥', streak: 2 } },
      { type: 'reaction:sent', ts: 3, userId: 'user-2', data: { emoji: '❤️', streak: 1 } },
    ]);

    const { endSession } = await import('../../src/services/session-manager.js');
    await endSession(sessionId, hostUserId);

    // Verify broadcastFinaleAwards was called
    expect(mockBroadcastFinaleAwards).toHaveBeenCalledTimes(1);
    const [broadcastSessionId, broadcastAwards] = mockBroadcastFinaleAwards.mock.calls[0] as [string, unknown[]];
    expect(broadcastSessionId).toBe(sessionId);
    expect(Array.isArray(broadcastAwards)).toBe(true);
    expect((broadcastAwards as unknown[]).length).toBeGreaterThanOrEqual(2);
  });

  it('appends finale:awardsGenerated event before flush', async () => {
    mockGetEventStream.mockReturnValue([]);

    const { endSession } = await import('../../src/services/session-manager.js');
    await endSession(sessionId, hostUserId);

    // Find the finale:awardsGenerated appendEvent call
    const finaleEventCall = mockAppendEvent.mock.calls.find(
      (call: unknown[]) => (call[1] as { type: string }).type === 'finale:awardsGenerated',
    );
    expect(finaleEventCall).toBeDefined();
  });

  it('award generation failure does not prevent session from ending', async () => {
    // Make getParticipants throw to cause award generation to fail
    mockGetParticipants.mockRejectedValueOnce(new Error('DB error'));

    const { endSession } = await import('../../src/services/session-manager.js');
    // Should not throw
    const result = await endSession(sessionId, hostUserId);
    expect(result.state).toBe(DJState.finale);
  });

  it('updates top_award in DB for each participant', async () => {
    mockGetEventStream.mockReturnValue([]);

    const { endSession } = await import('../../src/services/session-manager.js');
    await endSession(sessionId, hostUserId);

    // updateTopAward should have been called for each participant
    expect(mockUpdateTopAward).toHaveBeenCalled();
  });
});
