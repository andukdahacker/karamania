import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestSession } from '../factories/session.js';
import { createTestParticipant } from '../factories/participant.js';

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

const mockGenerateUniquePartyCode = vi.fn();
vi.mock('../../src/services/party-code.js', () => ({
  generateUniquePartyCode: mockGenerateUniquePartyCode,
}));

const mockSessionCreate = vi.fn();
const mockAddParticipant = vi.fn();
const mockAddParticipantIfNotExists = vi.fn();
const mockGetParticipants = vi.fn();
const mockFindById = vi.fn();
const mockUpdateStatus = vi.fn();
const mockUpdateHost = vi.fn();
const mockUpdateDjState = vi.fn();
const mockWriteEventStream = vi.fn();
vi.mock('../../src/persistence/session-repository.js', () => ({
  create: mockSessionCreate,
  addParticipant: mockAddParticipant,
  addParticipantIfNotExists: mockAddParticipantIfNotExists,
  getParticipants: mockGetParticipants,
  findById: mockFindById,
  updateStatus: mockUpdateStatus,
  updateHost: mockUpdateHost,
  updateDjState: mockUpdateDjState,
  writeEventStream: mockWriteEventStream,
  incrementParticipationScore: vi.fn().mockResolvedValue(undefined),
  getParticipantScore: vi.fn(),
}));

const mockDjContext = {
  state: 'lobby',
  sessionId: 'session-1',
  participantCount: 3,
  songCount: 0,
  sessionStartedAt: null,
  currentPerformer: null,
  timerStartedAt: null,
  timerDurationMs: null,
  cycleHistory: ['lobby'],
  metadata: {},
};
const mockTransitionResult = {
  newContext: {
    ...mockDjContext,
    state: 'songSelection',
    cycleHistory: ['lobby', 'songSelection'],
  },
  sideEffects: [
    { type: 'cancelTimer', data: {} },
    { type: 'broadcast', data: { from: 'lobby', to: 'songSelection' } },
    { type: 'persist', data: { context: { state: 'songSelection' } } },
  ],
};
const mockProcessTransition = vi.fn().mockReturnValue(mockTransitionResult);
vi.mock('../../src/dj-engine/machine.js', () => ({
  createDJContext: vi.fn().mockReturnValue(mockDjContext),
  processTransition: (...args: unknown[]) => mockProcessTransition(...args),
}));

vi.mock('../../src/dj-engine/serializer.js', () => ({
  deserializeDJContext: vi.fn(),
  serializeDJContext: vi.fn().mockReturnValue({}),
}));

const mockSetSessionDjState = vi.fn();
vi.mock('../../src/services/dj-state-store.js', () => ({
  getSessionDjState: vi.fn(),
  setSessionDjState: (...args: unknown[]) => mockSetSessionDjState(...args),
  removeSessionDjState: vi.fn(),
}));

vi.mock('../../src/services/timer-scheduler.js', () => ({
  scheduleSessionTimer: vi.fn(),
  cancelSessionTimer: vi.fn(),
}));

const mockAppendEvent = vi.fn();
const mockFlushEventStream = vi.fn();
const mockGetEventStream = vi.fn().mockReturnValue([]);
vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
  flushEventStream: (...args: unknown[]) => mockFlushEventStream(...args),
  getEventStream: (...args: unknown[]) => mockGetEventStream(...args),
}));

const mockGetActiveConnections = vi.fn();
vi.mock('../../src/services/connection-tracker.js', () => ({
  getActiveConnections: (...args: unknown[]) => mockGetActiveConnections(...args),
  removeSession: vi.fn(),
}));

const mockDealCard = vi.fn();
vi.mock('../../src/services/card-dealer.js', () => ({
  dealCard: (...args: unknown[]) => mockDealCard(...args),
  redealCard: vi.fn(),
  clearDealtCards: vi.fn(),
}));

const mockBroadcastDjState = vi.fn();
const mockBroadcastCardDealt = vi.fn();
vi.mock('../../src/services/dj-broadcaster.js', () => ({
  broadcastDjState: (...args: unknown[]) => mockBroadcastDjState(...args),
  broadcastDjPause: vi.fn(),
  broadcastDjResume: vi.fn(),
  broadcastCeremonyAnticipation: vi.fn(),
  broadcastCeremonyReveal: vi.fn(),
  broadcastCeremonyQuick: vi.fn(),
  broadcastCardDealt: (...args: unknown[]) => mockBroadcastCardDealt(...args),
}));

vi.mock('../../src/services/activity-tracker.js', () => ({
  recordActivity: vi.fn(),
  removeSession: vi.fn(),
}));

vi.mock('../../src/services/streak-tracker.js', () => ({
  clearSessionStreaks: vi.fn(),
}));

vi.mock('../../src/services/award-generator.js', () => ({
  generateAward: vi.fn().mockReturnValue('Star of the Show'),
  AWARD_TEMPLATES: [],
  AwardTone: { comedic: 'comedic' },
}));

vi.mock('../../src/services/participation-scoring.js', () => ({
  calculateScoreIncrement: vi.fn().mockReturnValue(0),
  ACTION_TIER_MAP: {},
}));

describe('session-manager', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('createSession', () => {
    it('returns sessionId and partyCode', async () => {
      const testSession = createTestSession({ id: 'session-id-1', party_code: 'ABCD' });
      const testParticipant = createTestParticipant({ session_id: 'session-id-1', user_id: 'user-1' });
      mockGenerateUniquePartyCode.mockResolvedValue('ABCD');
      mockSessionCreate.mockResolvedValue(testSession);
      mockAddParticipant.mockResolvedValue(testParticipant);

      const { createSession } = await import('../../src/services/session-manager.js');
      const result = await createSession({
        hostUserId: 'user-1',
        displayName: 'Host User',
      });

      expect(result).toEqual({
        sessionId: 'session-id-1',
        partyCode: 'ABCD',
      });
    });

    it('calls generateUniquePartyCode, sessionRepo.create, sessionRepo.addParticipant in order', async () => {
      const callOrder: string[] = [];
      mockGenerateUniquePartyCode.mockImplementation(async () => {
        callOrder.push('generateUniquePartyCode');
        return 'ABCD';
      });
      mockSessionCreate.mockImplementation(async () => {
        callOrder.push('sessionCreate');
        return createTestSession({ id: 'session-id-1', party_code: 'ABCD' });
      });
      mockAddParticipant.mockImplementation(async () => {
        callOrder.push('addParticipant');
        return createTestParticipant({ session_id: 'session-id-1', user_id: 'user-1' });
      });

      const { createSession } = await import('../../src/services/session-manager.js');
      await createSession({ hostUserId: 'user-1', displayName: 'Host' });

      expect(callOrder).toEqual([
        'generateUniquePartyCode',
        'sessionCreate',
        'addParticipant',
      ]);
    });

    it('uses provided vibe', async () => {
      mockGenerateUniquePartyCode.mockResolvedValue('ROCK');
      mockSessionCreate.mockResolvedValue(createTestSession({ id: 'session-1', party_code: 'ROCK' }));
      mockAddParticipant.mockResolvedValue(createTestParticipant());

      const { createSession } = await import('../../src/services/session-manager.js');
      await createSession({
        hostUserId: 'user-1',
        displayName: 'Host',
        vibe: 'rock',
      });

      expect(mockSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({ vibe: 'rock' })
      );
    });

    it('defaults vibe to general when not provided', async () => {
      mockGenerateUniquePartyCode.mockResolvedValue('VIBE');
      mockSessionCreate.mockResolvedValue(createTestSession({ id: 'session-1', party_code: 'VIBE' }));
      mockAddParticipant.mockResolvedValue(createTestParticipant());

      const { createSession } = await import('../../src/services/session-manager.js');
      await createSession({
        hostUserId: 'user-1',
        displayName: 'Host',
      });

      expect(mockSessionCreate).toHaveBeenCalledWith(
        expect.objectContaining({ vibe: 'general' })
      );
    });
  });

  describe('startSession', () => {
    it('updates status to active when valid', async () => {
      const testSession = createTestSession({ id: 'session-1', status: 'lobby', host_user_id: 'host-user' });
      mockFindById.mockResolvedValue(testSession);
      mockGetParticipants.mockResolvedValue([
        { id: 'p1', user_id: 'host-user', guest_name: null, display_name: 'Host', joined_at: new Date() },
        { id: 'p2', user_id: null, guest_name: 'Alice', display_name: null, joined_at: new Date() },
        { id: 'p3', user_id: null, guest_name: 'Bob', display_name: null, joined_at: new Date() },
      ]);
      mockUpdateStatus.mockResolvedValue(undefined);

      const { startSession } = await import('../../src/services/session-manager.js');
      const result = await startSession({ sessionId: 'session-1', hostUserId: 'host-user' });

      expect(mockUpdateStatus).toHaveBeenCalledWith('session-1', 'active');
      expect(result).toMatchObject({ status: 'active' });
      expect(result.djContext).toEqual(mockTransitionResult.newContext);
      expect(result.sideEffects).toEqual(mockTransitionResult.sideEffects);
    });

    it('throws when session not in lobby status', async () => {
      const testSession = createTestSession({ id: 'session-1', status: 'active', host_user_id: 'host-user' });
      mockFindById.mockResolvedValue(testSession);

      const { startSession } = await import('../../src/services/session-manager.js');

      await expect(startSession({ sessionId: 'session-1', hostUserId: 'host-user' }))
        .rejects.toMatchObject({ code: 'INVALID_STATUS' });
    });

    it('throws when caller is not the host', async () => {
      const testSession = createTestSession({ id: 'session-1', status: 'lobby', host_user_id: 'host-user' });
      mockFindById.mockResolvedValue(testSession);

      const { startSession } = await import('../../src/services/session-manager.js');

      await expect(startSession({ sessionId: 'session-1', hostUserId: 'not-the-host' }))
        .rejects.toMatchObject({ code: 'NOT_HOST' });
    });

    it('throws when fewer than 3 participants', async () => {
      const testSession = createTestSession({ id: 'session-1', status: 'lobby', host_user_id: 'host-user' });
      mockFindById.mockResolvedValue(testSession);
      mockGetParticipants.mockResolvedValue([
        { id: 'p1', user_id: 'host-user', guest_name: null, display_name: 'Host', joined_at: new Date() },
        { id: 'p2', user_id: null, guest_name: 'Alice', display_name: null, joined_at: new Date() },
      ]);

      const { startSession } = await import('../../src/services/session-manager.js');

      await expect(startSession({ sessionId: 'session-1', hostUserId: 'host-user' }))
        .rejects.toMatchObject({ code: 'INSUFFICIENT_PLAYERS' });
    });

    it('throws when session does not exist', async () => {
      mockFindById.mockResolvedValue(undefined);

      const { startSession } = await import('../../src/services/session-manager.js');

      await expect(startSession({ sessionId: 'nonexistent', hostUserId: 'host-user' }))
        .rejects.toMatchObject({ code: 'SESSION_NOT_FOUND' });
    });
  });

  describe('handleParticipantJoin', () => {
    it('adds participant and returns participant list with count and vibe', async () => {
      mockAddParticipantIfNotExists.mockResolvedValue(undefined);
      mockGetParticipants.mockResolvedValue([
        { id: 'p1', user_id: 'user-1', guest_name: null, display_name: 'Host', joined_at: new Date() },
        { id: 'p2', user_id: null, guest_name: 'Alice', display_name: null, joined_at: new Date() },
      ]);
      mockFindById.mockResolvedValue(createTestSession({ id: 'session-1', vibe: 'rock' }));

      const { handleParticipantJoin } = await import('../../src/services/session-manager.js');
      const result = await handleParticipantJoin({
        sessionId: 'session-1',
        userId: 'guest-uuid',
        role: 'guest',
        displayName: 'Alice',
      });

      expect(result.participantCount).toBe(2);
      expect(result.vibe).toBe('rock');
      expect(result.status).toBe('lobby');
      expect(result.hostUserId).toBeDefined();
      expect(result.participants).toEqual([
        { userId: 'user-1', displayName: 'Host' },
        { userId: 'p2', displayName: 'Alice' },
      ]);
    });

    it('calls addParticipantIfNotExists with guestName for guest role', async () => {
      mockAddParticipantIfNotExists.mockResolvedValue(undefined);
      mockGetParticipants.mockResolvedValue([]);
      mockFindById.mockResolvedValue(createTestSession({ id: 'session-1' }));

      const { handleParticipantJoin } = await import('../../src/services/session-manager.js');
      await handleParticipantJoin({
        sessionId: 'session-1',
        userId: 'guest-uuid',
        role: 'guest',
        displayName: 'Bob',
      });

      expect(mockAddParticipantIfNotExists).toHaveBeenCalledWith({
        sessionId: 'session-1',
        userId: undefined,
        guestName: 'Bob',
      });
    });

    it('calls addParticipantIfNotExists with userId for authenticated role', async () => {
      mockAddParticipantIfNotExists.mockResolvedValue(undefined);
      mockGetParticipants.mockResolvedValue([]);
      mockFindById.mockResolvedValue(createTestSession({ id: 'session-1' }));

      const { handleParticipantJoin } = await import('../../src/services/session-manager.js');
      await handleParticipantJoin({
        sessionId: 'session-1',
        userId: 'firebase-user-1',
        role: 'authenticated',
        displayName: 'Charlie',
      });

      expect(mockAddParticipantIfNotExists).toHaveBeenCalledWith({
        sessionId: 'session-1',
        userId: 'firebase-user-1',
        guestName: undefined,
      });
    });

    it('defaults vibe to general when session has no vibe', async () => {
      mockAddParticipantIfNotExists.mockResolvedValue(undefined);
      mockGetParticipants.mockResolvedValue([]);
      mockFindById.mockResolvedValue(createTestSession({ id: 'session-1', vibe: null }));

      const { handleParticipantJoin } = await import('../../src/services/session-manager.js');
      const result = await handleParticipantJoin({
        sessionId: 'session-1',
        userId: 'guest-uuid',
        role: 'guest',
        displayName: 'Dave',
      });

      expect(result.vibe).toBe('general');
    });

    it('returns hostUserId field', async () => {
      mockAddParticipantIfNotExists.mockResolvedValue(undefined);
      mockGetParticipants.mockResolvedValue([
        { id: 'p1', user_id: 'host-user', guest_name: null, display_name: 'Host', joined_at: new Date() },
      ]);
      mockFindById.mockResolvedValue(createTestSession({ id: 'session-1', host_user_id: 'host-user' }));

      const { handleParticipantJoin } = await import('../../src/services/session-manager.js');
      const result = await handleParticipantJoin({
        sessionId: 'session-1',
        userId: 'guest-uuid',
        role: 'guest',
        displayName: 'Eve',
      });

      expect(result.hostUserId).toBe('host-user');
    });
  });

  describe('transferHost', () => {
    it('updates host_user_id in DB', async () => {
      const testSession = createTestSession({ id: 'session-1', status: 'active', host_user_id: 'old-host' });
      mockFindById.mockResolvedValue(testSession);
      mockGetParticipants.mockResolvedValue([
        { id: 'p1', user_id: 'old-host', guest_name: null, display_name: 'OldHost', joined_at: new Date() },
        { id: 'p2', user_id: 'new-host', guest_name: null, display_name: 'NewHost', joined_at: new Date() },
      ]);
      mockUpdateHost.mockResolvedValue(undefined);

      const { transferHost } = await import('../../src/services/session-manager.js');
      await transferHost('session-1', 'new-host');

      expect(mockUpdateHost).toHaveBeenCalledWith('session-1', 'new-host');
    });

    it('returns new host info', async () => {
      const testSession = createTestSession({ id: 'session-1', status: 'active', host_user_id: 'old-host' });
      mockFindById.mockResolvedValue(testSession);
      mockGetParticipants.mockResolvedValue([
        { id: 'p1', user_id: 'old-host', guest_name: null, display_name: 'OldHost', joined_at: new Date() },
        { id: 'p2', user_id: 'new-host', guest_name: null, display_name: 'NewHost', joined_at: new Date() },
      ]);
      mockUpdateHost.mockResolvedValue(undefined);

      const { transferHost } = await import('../../src/services/session-manager.js');
      const result = await transferHost('session-1', 'new-host');

      expect(result).toEqual({
        newHostId: 'new-host',
        newHostName: 'NewHost',
      });
    });

    it('returns null for ended session', async () => {
      const testSession = createTestSession({ id: 'session-1', status: 'ended', host_user_id: 'old-host' });
      mockFindById.mockResolvedValue(testSession);

      const { transferHost } = await import('../../src/services/session-manager.js');
      const result = await transferHost('session-1', 'new-host');

      expect(result).toBeNull();
    });

    it('returns null for non-existent session', async () => {
      mockFindById.mockResolvedValue(undefined);

      const { transferHost } = await import('../../src/services/session-manager.js');
      const result = await transferHost('nonexistent', 'new-host');

      expect(result).toBeNull();
    });

    it('returns null when new host not in participants', async () => {
      const testSession = createTestSession({ id: 'session-1', status: 'active', host_user_id: 'old-host' });
      mockFindById.mockResolvedValue(testSession);
      mockGetParticipants.mockResolvedValue([
        { id: 'p1', user_id: 'old-host', guest_name: null, display_name: 'OldHost', joined_at: new Date() },
      ]);

      const { transferHost } = await import('../../src/services/session-manager.js');
      const result = await transferHost('session-1', 'not-a-participant');

      expect(result).toBeNull();
      expect(mockUpdateHost).not.toHaveBeenCalled();
    });
  });

  describe('event stream logging', () => {
    it('startSession appends party:started event', async () => {
      const testSession = createTestSession({ id: 'session-1', status: 'lobby', host_user_id: 'host-user' });
      mockFindById.mockResolvedValue(testSession);
      mockGetParticipants.mockResolvedValue([
        { id: 'p1', user_id: 'host-user', guest_name: null, display_name: 'Host', joined_at: new Date() },
        { id: 'p2', user_id: null, guest_name: 'Alice', display_name: null, joined_at: new Date() },
        { id: 'p3', user_id: null, guest_name: 'Bob', display_name: null, joined_at: new Date() },
      ]);
      mockUpdateStatus.mockResolvedValue(undefined);

      const { startSession } = await import('../../src/services/session-manager.js');
      await startSession({ sessionId: 'session-1', hostUserId: 'host-user' });

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'party:started',
        userId: 'host-user',
        data: { participantCount: 3 },
      }));
    });

    it('handleParticipantJoin appends party:joined event', async () => {
      mockAddParticipantIfNotExists.mockResolvedValue(undefined);
      mockGetParticipants.mockResolvedValue([]);
      mockFindById.mockResolvedValue(createTestSession({ id: 'session-1' }));

      const { handleParticipantJoin } = await import('../../src/services/session-manager.js');
      await handleParticipantJoin({
        sessionId: 'session-1',
        userId: 'user-2',
        role: 'guest',
        displayName: 'Alice',
      });

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'party:joined',
        userId: 'user-2',
        data: { displayName: 'Alice', role: 'guest' },
      }));
    });

    it('transferHost appends party:hostTransferred event', async () => {
      const testSession = createTestSession({ id: 'session-1', status: 'active', host_user_id: 'old-host' });
      mockFindById.mockResolvedValue(testSession);
      mockGetParticipants.mockResolvedValue([
        { id: 'p1', user_id: 'old-host', guest_name: null, display_name: 'OldHost', joined_at: new Date() },
        { id: 'p2', user_id: 'new-host', guest_name: null, display_name: 'NewHost', joined_at: new Date() },
      ]);
      mockUpdateHost.mockResolvedValue(undefined);

      const { transferHost } = await import('../../src/services/session-manager.js');
      await transferHost('session-1', 'new-host');

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'party:hostTransferred',
        data: { fromUserId: 'old-host', toUserId: 'new-host' },
      }));
    });

    it('kickPlayer appends party:kicked event', async () => {
      const testSession = createTestSession({ id: 'session-1', status: 'active', host_user_id: 'host-user' });
      mockFindById.mockResolvedValue(testSession);
      const mockRemoveParticipant = vi.fn().mockResolvedValue(undefined);
      vi.mocked(await import('../../src/persistence/session-repository.js')).removeParticipant = mockRemoveParticipant;

      const { kickPlayer } = await import('../../src/services/session-manager.js');
      await kickPlayer('session-1', 'host-user', 'target-user');

      expect(mockAppendEvent).toHaveBeenCalledWith('session-1', expect.objectContaining({
        type: 'party:kicked',
        userId: 'host-user',
        data: { kickedUserId: 'target-user' },
      }));
    });
  });

  describe('orchestrateCardDeal (via processDjTransition)', () => {
    const testCard = {
      id: 'chipmunk-mode',
      title: 'Chipmunk Mode',
      description: 'Sing high',
      type: 'vocal',
      emoji: '🐿️',
      minParticipants: 1,
    };

    const inputContext = {
      ...mockDjContext,
      state: 'song',
      songCount: 2,
      participantCount: 4,
      currentPerformer: null,
      metadata: {},
    };

    // processTransition returns partyCardDeal state so orchestrateCardDeal fires
    const partyCardDealResult = {
      newContext: {
        ...inputContext,
        state: 'partyCardDeal',
        cycleHistory: ['lobby', 'songSelection', 'partyCardDeal'],
      },
      sideEffects: [
        { type: 'broadcast', data: {} },
        { type: 'persist', data: { context: { state: 'partyCardDeal' } } },
      ],
    };

    function setupCardDealMocks() {
      mockProcessTransition.mockReturnValue(partyCardDealResult as never);
      mockGetActiveConnections.mockReturnValue([
        { socketId: 's1', userId: 'host-user', displayName: 'Host', connectedAt: 1000, isHost: true },
        { socketId: 's2', userId: 'singer-1', displayName: 'Alice', connectedAt: 1001, isHost: false },
        { socketId: 's3', userId: 'singer-2', displayName: 'Bob', connectedAt: 1002, isHost: false },
      ]);
      mockDealCard.mockReturnValue(testCard);
    }

    it('sets currentPerformer from active non-host connections using round-robin', async () => {
      setupCardDealMocks();
      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', inputContext as never, { type: 'CARD_DONE' } as never);

      // songCount=2, 2 non-host connections → index = 2 % 2 = 0 → 'singer-1'
      expect(mockSetSessionDjState).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          currentPerformer: 'singer-1',
        }),
      );
    });

    it('deals a card and stores it in DJ context metadata', async () => {
      setupCardDealMocks();
      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', inputContext as never, { type: 'CARD_DONE' } as never);

      expect(mockDealCard).toHaveBeenCalledWith('session-1', expect.any(Number));
      expect(mockSetSessionDjState).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          metadata: expect.objectContaining({
            currentCard: {
              id: 'chipmunk-mode',
              title: 'Chipmunk Mode',
              description: 'Sing high',
              type: 'vocal',
              emoji: '🐿️',
            },
          }),
        }),
      );
    });

    it('initializes redrawUsed to false in metadata', async () => {
      setupCardDealMocks();
      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', inputContext as never, { type: 'CARD_DONE' } as never);

      expect(mockSetSessionDjState).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          metadata: expect.objectContaining({
            redrawUsed: false,
          }),
        }),
      );
    });

    it('increments card dealt count', async () => {
      setupCardDealMocks();
      const { processDjTransition, getCardStats } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', inputContext as never, { type: 'CARD_DONE' } as never);

      const stats = getCardStats('session-1');
      expect(stats.dealt).toBeGreaterThanOrEqual(1);
    });

    it('broadcasts card dealt to session room', async () => {
      setupCardDealMocks();
      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', inputContext as never, { type: 'CARD_DONE' } as never);

      expect(mockBroadcastCardDealt).toHaveBeenCalledWith('session-1', {
        cardId: 'chipmunk-mode',
        title: 'Chipmunk Mode',
        description: 'Sing high',
        cardType: 'vocal',
        emoji: '🐿️',
      });
    });

    it('appends card:dealt event to event stream', async () => {
      setupCardDealMocks();
      const { processDjTransition } = await import('../../src/services/session-manager.js');
      await processDjTransition('session-1', inputContext as never, { type: 'CARD_DONE' } as never);

      expect(mockAppendEvent).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'card:dealt',
          data: { cardId: 'chipmunk-mode', cardType: 'vocal' },
        }),
      );
    });
  });
});
