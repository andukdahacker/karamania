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

vi.mock('../../src/socket-handlers/connection-handler.js', () => ({
  clearSessionTimers: vi.fn(),
}));

vi.mock('../../src/services/finale-award-generator.js', () => ({
  analyzeSessionForAwards: vi.fn().mockReturnValue({ topPerformers: [], categories: {} }),
  generateFinaleAwards: vi.fn().mockReturnValue([]),
  FinaleAwardCategory: {},
}));

describe('calculateSessionStats (via initiateFinale)', () => {
  const sessionId = 'session-stats-test';
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
        participantCount: 4,
        sessionStartedAt: Date.now() - 600_000, // 10 minutes ago
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
  });

  it('aggregates reaction, sound, and card events correctly', async () => {
    mockGetEventStream.mockReturnValue([
      { type: 'reaction:sent', ts: 1, userId: 'user-1', data: { emoji: '🎉', streak: 1 } },
      { type: 'reaction:sent', ts: 2, userId: 'user-1', data: { emoji: '🔥', streak: 2 } },
      { type: 'reaction:sent', ts: 3, userId: 'user-2', data: { emoji: '❤️', streak: 1 } },
      { type: 'sound:play', ts: 4, userId: 'user-1', data: { soundId: 'airhorn' } },
      { type: 'sound:play', ts: 5, userId: 'user-2', data: { soundId: 'applause' } },
      { type: 'card:dealt', ts: 6, data: { cardId: 'card-1', cardType: 'dare' } },
    ]);

    mockGetActiveConnections.mockReturnValue([
      { socketId: 's1', userId: 'user-1', displayName: 'Alice', connectedAt: Date.now(), isHost: false },
      { socketId: 's2', userId: 'user-2', displayName: 'Bob', connectedAt: Date.now(), isHost: false },
    ]);

    const { initiateFinale } = await import('../../src/services/session-manager.js');
    await initiateFinale(sessionId, hostUserId);

    expect(mockBroadcastFinaleStats).toHaveBeenCalledTimes(1);
    const [broadcastSessionId, stats] = mockBroadcastFinaleStats.mock.calls[0] as [string, Record<string, unknown>];
    expect(broadcastSessionId).toBe(sessionId);
    expect(stats.totalReactions).toBe(3);
    expect(stats.totalSoundboardPlays).toBe(2);
    expect(stats.totalCardsDealt).toBe(1);
    expect(stats.songCount).toBe(3);
    expect(stats.participantCount).toBe(4);
  });

  it('returns zero counts for empty event stream', async () => {
    mockGetEventStream.mockReturnValue([]);

    const { initiateFinale } = await import('../../src/services/session-manager.js');
    await initiateFinale(sessionId, hostUserId);

    expect(mockBroadcastFinaleStats).toHaveBeenCalledTimes(1);
    const [, stats] = mockBroadcastFinaleStats.mock.calls[0] as [string, Record<string, unknown>];
    expect(stats.totalReactions).toBe(0);
    expect(stats.totalSoundboardPlays).toBe(0);
    expect(stats.totalCardsDealt).toBe(0);
    expect(stats.topReactor).toBeNull();
    expect(stats.longestStreak).toBe(0);
  });

  it('selects the participant with most reaction:sent events as topReactor', async () => {
    mockGetEventStream.mockReturnValue([
      { type: 'reaction:sent', ts: 1, userId: 'user-1', data: { emoji: '🎉', streak: 1 } },
      { type: 'reaction:sent', ts: 2, userId: 'user-2', data: { emoji: '🔥', streak: 1 } },
      { type: 'reaction:sent', ts: 3, userId: 'user-2', data: { emoji: '❤️', streak: 2 } },
      { type: 'reaction:sent', ts: 4, userId: 'user-2', data: { emoji: '🎶', streak: 3 } },
    ]);

    mockGetActiveConnections.mockReturnValue([
      { socketId: 's1', userId: 'user-1', displayName: 'Alice', connectedAt: Date.now(), isHost: false },
      { socketId: 's2', userId: 'user-2', displayName: 'Bob', connectedAt: Date.now(), isHost: false },
    ]);

    const { initiateFinale } = await import('../../src/services/session-manager.js');
    await initiateFinale(sessionId, hostUserId);

    expect(mockBroadcastFinaleStats).toHaveBeenCalledTimes(1);
    const [, stats] = mockBroadcastFinaleStats.mock.calls[0] as [string, { topReactor: { displayName: string; count: number } }];
    expect(stats.topReactor).toEqual({ displayName: 'Bob', count: 3 });
  });

  it('picks longest streak from reaction:sent data.streak field', async () => {
    mockGetEventStream.mockReturnValue([
      { type: 'reaction:sent', ts: 1, userId: 'user-1', data: { emoji: '🎉', streak: 2 } },
      { type: 'reaction:sent', ts: 2, userId: 'user-1', data: { emoji: '🔥', streak: 7 } },
      { type: 'reaction:sent', ts: 3, userId: 'user-2', data: { emoji: '❤️', streak: 4 } },
    ]);

    mockGetActiveConnections.mockReturnValue([
      { socketId: 's1', userId: 'user-1', displayName: 'Alice', connectedAt: Date.now(), isHost: false },
    ]);

    const { initiateFinale } = await import('../../src/services/session-manager.js');
    await initiateFinale(sessionId, hostUserId);

    expect(mockBroadcastFinaleStats).toHaveBeenCalledTimes(1);
    const [, stats] = mockBroadcastFinaleStats.mock.calls[0] as [string, { longestStreak: number }];
    expect(stats.longestStreak).toBe(7);
  });
});

describe('buildFinaleSetlist (via initiateFinale)', () => {
  const sessionId = 'session-setlist-test';
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
        songCount: 2,
        participantCount: 3,
      }),
    );

    mockProcessTransition.mockReturnValue({
      newContext: createTestDJContext({
        sessionId,
        state: DJState.finale,
        songCount: 2,
        participantCount: 3,
      }),
      sideEffects: [],
    });

    mockGetParticipants.mockResolvedValue([]);
    mockWriteEventStream.mockResolvedValue(undefined);
  });

  it('orders songs by position from dj:stateChanged events where data.to is song', async () => {
    const baseTs = 1000;
    mockGetEventStream.mockReturnValue([
      { type: 'dj:stateChanged', ts: baseTs, data: { from: 'songSelection', to: 'song', trigger: 'SONG_SELECTED' } },
      { type: 'song:detected', ts: baseTs + 10, data: { videoId: 'v1', title: 'Bohemian Rhapsody', artist: 'Queen' } },
      { type: 'dj:stateChanged', ts: baseTs + 100, data: { from: 'ceremony', to: 'songSelection', trigger: 'TIMER_EXPIRED' } },
      { type: 'dj:stateChanged', ts: baseTs + 200, data: { from: 'songSelection', to: 'song', trigger: 'SONG_SELECTED' } },
      { type: 'song:detected', ts: baseTs + 210, data: { videoId: 'v2', title: 'Don\'t Stop Me Now', artist: 'Queen' } },
    ]);

    mockGetActiveConnections.mockReturnValue([]);

    const { initiateFinale } = await import('../../src/services/session-manager.js');
    await initiateFinale(sessionId, hostUserId);

    expect(mockBroadcastFinaleSetlist).toHaveBeenCalledTimes(1);
    const [broadcastSessionId, setlist] = mockBroadcastFinaleSetlist.mock.calls[0] as [string, Array<{ position: number; title: string; artist: string }>];
    expect(broadcastSessionId).toBe(sessionId);
    expect(setlist).toHaveLength(2);
    expect(setlist[0].position).toBe(1);
    expect(setlist[0].title).toBe('Bohemian Rhapsody');
    expect(setlist[0].artist).toBe('Queen');
    expect(setlist[1].position).toBe(2);
    expect(setlist[1].title).toBe("Don't Stop Me Now");
    expect(setlist[1].artist).toBe('Queen');
  });

  it('matches awards from ceremony:awardGenerated events by songPosition', async () => {
    const baseTs = 1000;
    mockGetEventStream.mockReturnValue([
      { type: 'dj:stateChanged', ts: baseTs, data: { from: 'songSelection', to: 'song', trigger: 'SONG_SELECTED' } },
      { type: 'song:detected', ts: baseTs + 10, data: { videoId: 'v1', title: 'Bohemian Rhapsody', artist: 'Queen' } },
      { type: 'ceremony:awardGenerated', ts: baseTs + 50, userId: 'user-1', data: { award: 'Vocal Powerhouse', songPosition: 1, ceremonyType: 'full', tone: 'hype', contextFactors: { cardCompleted: false, reactionCount: 5, participationScore: 100 } } },
      { type: 'dj:stateChanged', ts: baseTs + 200, data: { from: 'songSelection', to: 'song', trigger: 'SONG_SELECTED' } },
      { type: 'song:detected', ts: baseTs + 210, data: { videoId: 'v2', title: 'Sweet Caroline', artist: 'Neil Diamond' } },
    ]);

    mockGetActiveConnections.mockReturnValue([
      { socketId: 's1', userId: 'user-1', displayName: 'Alice', connectedAt: Date.now(), isHost: false },
    ]);

    const { initiateFinale } = await import('../../src/services/session-manager.js');
    await initiateFinale(sessionId, hostUserId);

    expect(mockBroadcastFinaleSetlist).toHaveBeenCalledTimes(1);
    const [, setlist] = mockBroadcastFinaleSetlist.mock.calls[0] as [string, Array<{ position: number; awardTitle: string | null; awardTone: string | null; performerName: string | null }>];
    expect(setlist[0].awardTitle).toBe('Vocal Powerhouse');
    expect(setlist[0].awardTone).toBe('hype');
    expect(setlist[0].performerName).toBe('Alice');
    // Song 2 has no award
    expect(setlist[1].awardTitle).toBeNull();
    expect(setlist[1].awardTone).toBeNull();
  });

  it('sets awardTitle to null for songs without awards', async () => {
    const baseTs = 1000;
    mockGetEventStream.mockReturnValue([
      { type: 'dj:stateChanged', ts: baseTs, data: { from: 'songSelection', to: 'song', trigger: 'SONG_SELECTED' } },
      { type: 'song:detected', ts: baseTs + 10, data: { videoId: 'v1', title: 'Yesterday', artist: 'Beatles' } },
    ]);

    mockGetActiveConnections.mockReturnValue([]);

    const { initiateFinale } = await import('../../src/services/session-manager.js');
    await initiateFinale(sessionId, hostUserId);

    expect(mockBroadcastFinaleSetlist).toHaveBeenCalledTimes(1);
    const [, setlist] = mockBroadcastFinaleSetlist.mock.calls[0] as [string, Array<{ awardTitle: string | null }>];
    expect(setlist[0].awardTitle).toBeNull();
  });

  it('returns empty setlist for empty event stream', async () => {
    mockGetEventStream.mockReturnValue([]);

    const { initiateFinale } = await import('../../src/services/session-manager.js');
    await initiateFinale(sessionId, hostUserId);

    expect(mockBroadcastFinaleSetlist).toHaveBeenCalledTimes(1);
    const [, setlist] = mockBroadcastFinaleSetlist.mock.calls[0] as [string, unknown[]];
    expect(setlist).toHaveLength(0);
  });
});
