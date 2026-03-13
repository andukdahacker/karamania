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

const mockIncrementParticipationScore = vi.fn();
const mockAddParticipantIfNotExists = vi.fn();
const mockGetParticipants = vi.fn();
const mockFindById = vi.fn();
vi.mock('../../src/persistence/session-repository.js', () => ({
  create: vi.fn(),
  addParticipant: vi.fn(),
  addParticipantIfNotExists: mockAddParticipantIfNotExists,
  getParticipants: mockGetParticipants,
  findById: mockFindById,
  updateStatus: vi.fn(),
  updateHost: vi.fn(),
  updateDjState: vi.fn(),
  writeEventStream: vi.fn(),
  incrementParticipationScore: mockIncrementParticipationScore,
  getParticipantScore: vi.fn(),
}));

vi.mock('../../src/dj-engine/machine.js', () => ({
  createDJContext: vi.fn(),
  processTransition: vi.fn(),
}));

vi.mock('../../src/dj-engine/serializer.js', () => ({
  deserializeDJContext: vi.fn(),
}));

vi.mock('../../src/services/dj-state-store.js', () => ({
  getSessionDjState: vi.fn(),
  setSessionDjState: vi.fn(),
  removeSessionDjState: vi.fn(),
}));

vi.mock('../../src/services/timer-scheduler.js', () => ({
  scheduleSessionTimer: vi.fn(),
  cancelSessionTimer: vi.fn(),
}));

const mockAppendEvent = vi.fn();
vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: mockAppendEvent,
  flushEventStream: vi.fn().mockReturnValue([]),
}));

vi.mock('../../src/services/dj-broadcaster.js', () => ({
  broadcastDjState: vi.fn(),
  broadcastDjPause: vi.fn(),
  broadcastDjResume: vi.fn(),
  broadcastCeremonyAnticipation: vi.fn(),
  broadcastCeremonyReveal: vi.fn(),
}));

vi.mock('../../src/services/connection-tracker.js', () => ({
  removeSession: vi.fn(),
}));

vi.mock('../../src/services/activity-tracker.js', () => ({
  removeSession: vi.fn(),
}));

describe('session-manager scoring', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIncrementParticipationScore.mockResolvedValue(undefined);
  });

  describe('recordParticipationAction', () => {
    it('returns correct points for a valid action', async () => {
      const { recordParticipationAction, clearScoreCache } = await import('../../src/services/session-manager.js');
      clearScoreCache();

      const result = await recordParticipationAction('session-1', 'user-1', 'party:vibeChanged');
      expect(result).toEqual({ points: 3, totalScore: 3 });
    });

    it('returns null for unknown action', async () => {
      const { recordParticipationAction } = await import('../../src/services/session-manager.js');

      const result = await recordParticipationAction('session-1', 'user-1', 'unknown:action');
      expect(result).toBeNull();
    });

    it('appends participation:scored event to event stream', async () => {
      const { recordParticipationAction, clearScoreCache } = await import('../../src/services/session-manager.js');
      clearScoreCache();
      mockAppendEvent.mockClear();

      await recordParticipationAction('session-1', 'user-1', 'party:joined', 1.0);

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'participation:scored',
        userId: 'user-1',
        data: expect.objectContaining({
          action: 'party:joined',
          tier: 'passive',
          points: 1,
          rewardMultiplier: 1.0,
          totalScore: expect.any(Number),
        }),
      }));
    });

    it('event data includes correct tier, points, rewardMultiplier, totalScore', async () => {
      const { recordParticipationAction, clearScoreCache } = await import('../../src/services/session-manager.js');
      clearScoreCache();
      mockAppendEvent.mockClear();

      await recordParticipationAction('session-1', 'user-1', 'card:accepted', 0.5);

      const eventCall = mockAppendEvent.mock.calls.find(
        (call: unknown[]) => (call[1] as { type: string }).type === 'participation:scored'
      );
      expect(eventCall).toBeDefined();
      const event = eventCall![1] as { data: { tier: string; points: number; rewardMultiplier: number; totalScore: number } };
      expect(event.data.tier).toBe('engaged');
      expect(event.data.points).toBe(3); // 5 * 0.5 = 2.5 → 3
      expect(event.data.rewardMultiplier).toBe(0.5);
      expect(event.data.totalScore).toBe(3);
    });

    it('accumulates totalScore across multiple calls (in-memory cache)', async () => {
      const { recordParticipationAction, clearScoreCache } = await import('../../src/services/session-manager.js');
      clearScoreCache();

      const result1 = await recordParticipationAction('session-1', 'user-1', 'party:joined');
      expect(result1).toEqual({ points: 1, totalScore: 1 });

      const result2 = await recordParticipationAction('session-1', 'user-1', 'party:vibeChanged');
      expect(result2).toEqual({ points: 3, totalScore: 4 });

      const result3 = await recordParticipationAction('session-1', 'user-1', 'card:accepted');
      expect(result3).toEqual({ points: 5, totalScore: 9 });
    });

    it('calls incrementParticipationScore with correct args (fire-and-forget)', async () => {
      const { recordParticipationAction, clearScoreCache } = await import('../../src/services/session-manager.js');
      clearScoreCache();

      await recordParticipationAction('session-1', 'user-1', 'party:vibeChanged', 1.0);

      expect(mockIncrementParticipationScore).toHaveBeenCalledWith('session-1', 'user-1', 3);
    });

    it('does not throw when DB persistence fails', async () => {
      mockIncrementParticipationScore.mockRejectedValue(new Error('DB error'));
      const { recordParticipationAction, clearScoreCache } = await import('../../src/services/session-manager.js');
      clearScoreCache();

      const result = await recordParticipationAction('session-1', 'user-1', 'party:joined');
      expect(result).toEqual({ points: 1, totalScore: expect.any(Number) });
    });
  });

  describe('clearScoreCache', () => {
    it('resets cached scores so next call starts from 0', async () => {
      const { recordParticipationAction, clearScoreCache } = await import('../../src/services/session-manager.js');
      clearScoreCache();

      await recordParticipationAction('session-1', 'user-1', 'card:accepted');

      clearScoreCache();

      const result = await recordParticipationAction('session-1', 'user-1', 'party:joined');
      expect(result).toEqual({ points: 1, totalScore: 1 });
    });

    it('clears only the specified session when sessionId is provided', async () => {
      const { recordParticipationAction, clearScoreCache } = await import('../../src/services/session-manager.js');
      clearScoreCache();

      // Score in two sessions
      await recordParticipationAction('session-1', 'user-1', 'card:accepted');
      await recordParticipationAction('session-2', 'user-2', 'party:vibeChanged');

      // Clear only session-1
      clearScoreCache('session-1');

      // session-1 should restart from 0
      const result1 = await recordParticipationAction('session-1', 'user-1', 'party:joined');
      expect(result1).toEqual({ points: 1, totalScore: 1 });

      // session-2 should retain its cached score
      const result2 = await recordParticipationAction('session-2', 'user-2', 'party:joined');
      expect(result2).toEqual({ points: 1, totalScore: 4 }); // 3 (vibe) + 1 (join) = 4
    });
  });

  describe('handleParticipantJoin scoring', () => {
    it('calls scoring for authenticated users', async () => {
      mockAddParticipantIfNotExists.mockResolvedValue(undefined);
      mockGetParticipants.mockResolvedValue([
        { id: 'p1', user_id: 'user-1', guest_name: null, display_name: 'Host' },
      ]);
      mockFindById.mockResolvedValue({ vibe: 'general', status: 'lobby', host_user_id: 'user-1' });

      const { handleParticipantJoin, clearScoreCache } = await import('../../src/services/session-manager.js');
      clearScoreCache();
      mockIncrementParticipationScore.mockClear();

      await handleParticipantJoin({
        sessionId: 'session-1',
        userId: 'user-1',
        role: 'authenticated',
        displayName: 'Host',
      });

      expect(mockIncrementParticipationScore).toHaveBeenCalledWith('session-1', 'user-1', 1);
    });

    it('does NOT call scoring for guest users', async () => {
      mockAddParticipantIfNotExists.mockResolvedValue(undefined);
      mockGetParticipants.mockResolvedValue([
        { id: 'p1', user_id: null, guest_name: 'Alice', display_name: null },
      ]);
      mockFindById.mockResolvedValue({ vibe: 'general', status: 'lobby', host_user_id: 'user-1' });

      const { handleParticipantJoin, clearScoreCache } = await import('../../src/services/session-manager.js');
      clearScoreCache();
      mockIncrementParticipationScore.mockClear();

      await handleParticipantJoin({
        sessionId: 'session-1',
        userId: 'guest-id',
        role: 'guest',
        displayName: 'Alice',
      });

      expect(mockIncrementParticipationScore).not.toHaveBeenCalled();
    });
  });
});
