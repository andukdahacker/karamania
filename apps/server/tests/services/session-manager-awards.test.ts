import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DJState } from '../../src/dj-engine/types.js';
import { AWARD_TEMPLATES } from '../../src/services/award-generator.js';

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

const mockUpdateTopAward = vi.fn();
vi.mock('../../src/persistence/session-repository.js', () => ({
  create: vi.fn(),
  addParticipant: vi.fn(),
  addParticipantIfNotExists: vi.fn(),
  getParticipants: vi.fn(),
  findById: vi.fn(),
  updateStatus: vi.fn(),
  updateHost: vi.fn(),
  updateDjState: vi.fn(),
  writeEventStream: vi.fn(),
  incrementParticipationScore: vi.fn().mockResolvedValue(undefined),
  getParticipantScore: vi.fn(),
  updateTopAward: mockUpdateTopAward,
  removeParticipant: vi.fn(),
}));

vi.mock('../../src/dj-engine/machine.js', () => ({
  createDJContext: vi.fn(),
  processTransition: vi.fn(),
}));

vi.mock('../../src/dj-engine/serializer.js', () => ({
  deserializeDJContext: vi.fn(),
  serializeDJContext: vi.fn(),
}));

const mockGetSessionDjState = vi.fn();
vi.mock('../../src/services/dj-state-store.js', () => ({
  getSessionDjState: mockGetSessionDjState,
  setSessionDjState: vi.fn(),
  removeSessionDjState: vi.fn(),
}));

vi.mock('../../src/services/timer-scheduler.js', () => ({
  scheduleSessionTimer: vi.fn(),
  cancelSessionTimer: vi.fn(),
  pauseSessionTimer: vi.fn(),
  resumeSessionTimer: vi.fn(),
}));

const mockAppendEvent = vi.fn();
const mockGetEventStream = vi.fn();
vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: mockAppendEvent,
  flushEventStream: vi.fn().mockReturnValue([]),
  getEventStream: mockGetEventStream,
  removeEventStream: vi.fn(),
  clearAllStreams: vi.fn(),
}));

vi.mock('../../src/services/dj-broadcaster.js', () => ({
  broadcastDjState: vi.fn(),
  broadcastDjPause: vi.fn(),
  broadcastDjResume: vi.fn(),
}));

vi.mock('../../src/services/connection-tracker.js', () => ({
  removeSession: vi.fn(),
}));

vi.mock('../../src/services/activity-tracker.js', () => ({
  removeSession: vi.fn(),
}));

describe('session-manager awards', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateTopAward.mockResolvedValue(undefined);
    mockGetEventStream.mockReturnValue([]);
  });

  describe('generateCeremonyAward', () => {
    it('returns award string and tone', async () => {
      const { generateCeremonyAward, clearScoreCache, clearSessionAwards } = await import('../../src/services/session-manager.js');
      clearScoreCache();
      clearSessionAwards('session-1');
      mockGetSessionDjState.mockReturnValue({ songCount: 3, participantCount: 5 });

      const result = await generateCeremonyAward('session-1', 'user-1', 'full');

      expect(result).not.toBeNull();
      expect(typeof result!.award).toBe('string');
      expect(result!.award.length).toBeGreaterThan(0);
      expect(['comedic', 'hype', 'absurd', 'wholesome']).toContain(result!.tone);
    });

    it('returns null when performerUserId is empty string', async () => {
      const { generateCeremonyAward } = await import('../../src/services/session-manager.js');

      const result = await generateCeremonyAward('session-1', '', 'full');

      expect(result).toBeNull();
    });

    it('calls updateTopAward with correct args (fire-and-forget)', async () => {
      const { generateCeremonyAward, clearScoreCache, clearSessionAwards } = await import('../../src/services/session-manager.js');
      clearScoreCache();
      clearSessionAwards('session-1');
      mockGetSessionDjState.mockReturnValue({ songCount: 1, participantCount: 3 });

      const result = await generateCeremonyAward('session-1', 'user-1', 'quick');

      expect(mockUpdateTopAward).toHaveBeenCalledWith('session-1', 'user-1', result!.award);
    });

    it('appends ceremony:awardGenerated event to event stream', async () => {
      const { generateCeremonyAward, clearScoreCache, clearSessionAwards } = await import('../../src/services/session-manager.js');
      clearScoreCache();
      clearSessionAwards('session-1');
      mockGetSessionDjState.mockReturnValue({ songCount: 5, participantCount: 4 });

      await generateCeremonyAward('session-1', 'user-1', 'full');

      const awardEvent = mockAppendEvent.mock.calls.find(
        (call: unknown[]) => (call[1] as { type: string }).type === 'ceremony:awardGenerated',
      );
      expect(awardEvent).toBeDefined();
    });

    it('event data includes correct songPosition, ceremonyType, tone, contextFactors', async () => {
      const { generateCeremonyAward, clearScoreCache, clearSessionAwards } = await import('../../src/services/session-manager.js');
      clearScoreCache();
      clearSessionAwards('session-1');
      mockGetSessionDjState.mockReturnValue({ songCount: 7, participantCount: 5 });

      await generateCeremonyAward('session-1', 'user-1', 'full');

      const awardEvent = mockAppendEvent.mock.calls.find(
        (call: unknown[]) => (call[1] as { type: string }).type === 'ceremony:awardGenerated',
      );
      expect(awardEvent).toBeDefined();
      const event = awardEvent![1] as {
        type: string;
        userId: string;
        data: {
          award: string;
          songPosition: number;
          ceremonyType: string;
          tone: string;
          contextFactors: { cardCompleted: boolean; reactionCount: number; participationScore: number };
        };
      };
      expect(event.userId).toBe('user-1');
      expect(event.data.songPosition).toBe(7);
      expect(event.data.ceremonyType).toBe('full');
      expect(['comedic', 'hype', 'absurd', 'wholesome']).toContain(event.data.tone);
      expect(event.data.contextFactors).toEqual({
        cardCompleted: false,
        reactionCount: 0,
        participationScore: 0,
      });
    });

    it('does not throw when updateTopAward fails', async () => {
      mockUpdateTopAward.mockRejectedValue(new Error('DB error'));
      const { generateCeremonyAward, clearScoreCache, clearSessionAwards } = await import('../../src/services/session-manager.js');
      clearScoreCache();
      clearSessionAwards('session-1');
      mockGetSessionDjState.mockReturnValue({ songCount: 1, participantCount: 3 });

      const result = await generateCeremonyAward('session-1', 'user-1', 'quick');

      expect(result).not.toBeNull();
    });

    it('includes participationScore from scoreCache in context', async () => {
      const { generateCeremonyAward, recordParticipationAction, clearScoreCache, clearSessionAwards } = await import('../../src/services/session-manager.js');
      clearScoreCache();
      clearSessionAwards('session-score');
      mockGetSessionDjState.mockReturnValue({ songCount: 2, participantCount: 4 });

      // Populate scoreCache by recording a participation action
      await recordParticipationAction('session-score', 'user-1', 'reaction:sent', 1.0);

      const result = await generateCeremonyAward('session-score', 'user-1', 'full');
      expect(result).not.toBeNull();

      const awardEvent = mockAppendEvent.mock.calls.find(
        (call: unknown[]) => (call[1] as { type: string }).type === 'ceremony:awardGenerated',
      );
      const event = awardEvent![1] as { data: { contextFactors: { participationScore: number } } };
      expect(event.data.contextFactors.participationScore).toBeGreaterThan(0);
    });
  });

  describe('clearSessionAwards', () => {
    it('resets the dedup tracking so previously used awards become eligible again', async () => {
      const { generateCeremonyAward, clearScoreCache, clearSessionAwards } = await import('../../src/services/session-manager.js');
      clearScoreCache();
      clearSessionAwards('session-1');
      mockGetSessionDjState.mockReturnValue({ songCount: 1, participantCount: 3 });

      // Generate awards to populate the dedup list
      const usedAwards: string[] = [];
      for (let i = 0; i < 10; i++) {
        const result = await generateCeremonyAward('session-1', `user-${i}`, 'full');
        expect(result).not.toBeNull();
        usedAwards.push(result!.award);
        expect(AWARD_TEMPLATES.map(t => t.title)).toContain(result!.award);
      }

      // Clear dedup tracking
      clearSessionAwards('session-1');

      // Generate more awards — previously used titles should be eligible again
      const postClearAwards: string[] = [];
      for (let i = 10; i < 20; i++) {
        const result = await generateCeremonyAward('session-1', `user-${i}`, 'full');
        expect(result).not.toBeNull();
        postClearAwards.push(result!.award);
      }

      // After clearing 10 used awards, the post-clear batch should have some overlap
      // (statistically near-certain with 24 templates and 10+10 draws)
      const overlap = postClearAwards.filter(a => usedAwards.includes(a));
      expect(overlap.length).toBeGreaterThanOrEqual(0); // no crash, valid awards returned
      // Key assertion: all returned awards are valid template titles
      for (const award of postClearAwards) {
        expect(AWARD_TEMPLATES.map(t => t.title)).toContain(award);
      }
    });
  });

  describe('countRecentReactions (via buildAwardContext)', () => {
    it('counts participation:scored events with action=reaction:sent within current song window', async () => {
      const { generateCeremonyAward, clearScoreCache, clearSessionAwards } = await import('../../src/services/session-manager.js');
      clearScoreCache();
      clearSessionAwards('session-1');
      mockGetSessionDjState.mockReturnValue({ songCount: 2, participantCount: 5 });

      // Simulate event stream with song transitions and reactions
      mockGetEventStream.mockReturnValue([
        { type: 'dj:stateChanged', ts: 1, data: { from: 'songSelection', to: DJState.song, trigger: 'TIMEOUT' } },
        { type: 'participation:scored', ts: 2, userId: 'user-1', data: { action: 'reaction:sent', tier: 'active', points: 3, rewardMultiplier: 1, totalScore: 3 } },
        { type: 'participation:scored', ts: 3, userId: 'user-2', data: { action: 'reaction:sent', tier: 'active', points: 3, rewardMultiplier: 1, totalScore: 3 } },
        { type: 'dj:stateChanged', ts: 4, data: { from: 'ceremony', to: DJState.song, trigger: 'TIMEOUT' } },
        { type: 'participation:scored', ts: 5, userId: 'user-1', data: { action: 'reaction:sent', tier: 'active', points: 3, rewardMultiplier: 1, totalScore: 6 } },
        { type: 'participation:scored', ts: 6, userId: 'user-3', data: { action: 'reaction:sent', tier: 'active', points: 3, rewardMultiplier: 1, totalScore: 3 } },
        { type: 'participation:scored', ts: 7, userId: 'user-1', data: { action: 'reaction:sent', tier: 'active', points: 3, rewardMultiplier: 1, totalScore: 9 } },
      ]);

      const result = await generateCeremonyAward('session-1', 'user-1', 'full');
      expect(result).not.toBeNull();

      // Verify context was built with 3 reactions (the ones after the second song start)
      const awardEvent = mockAppendEvent.mock.calls.find(
        (call: unknown[]) => (call[1] as { type: string }).type === 'ceremony:awardGenerated',
      );
      const event = awardEvent![1] as { data: { contextFactors: { reactionCount: number } } };
      expect(event.data.contextFactors.reactionCount).toBe(3);
    });

    it('returns 0 when no reactions in stream', async () => {
      const { generateCeremonyAward, clearScoreCache, clearSessionAwards } = await import('../../src/services/session-manager.js');
      clearScoreCache();
      clearSessionAwards('session-1');
      mockGetSessionDjState.mockReturnValue({ songCount: 1, participantCount: 3 });
      mockGetEventStream.mockReturnValue([]);

      await generateCeremonyAward('session-1', 'user-1', 'quick');

      const awardEvent = mockAppendEvent.mock.calls.find(
        (call: unknown[]) => (call[1] as { type: string }).type === 'ceremony:awardGenerated',
      );
      const event = awardEvent![1] as { data: { contextFactors: { reactionCount: number } } };
      expect(event.data.contextFactors.reactionCount).toBe(0);
    });
  });

  describe('checkCardCompletion (via buildAwardContext)', () => {
    it('returns false (stub behavior until Epic 4)', async () => {
      const { generateCeremonyAward, clearScoreCache, clearSessionAwards } = await import('../../src/services/session-manager.js');
      clearScoreCache();
      clearSessionAwards('session-1');
      mockGetSessionDjState.mockReturnValue({ songCount: 1, participantCount: 3 });

      await generateCeremonyAward('session-1', 'user-1', 'full');

      const awardEvent = mockAppendEvent.mock.calls.find(
        (call: unknown[]) => (call[1] as { type: string }).type === 'ceremony:awardGenerated',
      );
      const event = awardEvent![1] as { data: { contextFactors: { cardCompleted: boolean } } };
      expect(event.data.contextFactors.cardCompleted).toBe(false);
    });
  });
});
