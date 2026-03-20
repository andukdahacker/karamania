import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDJContext } from '../factories/dj-state.js';

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

const mockGetSessionDjState = vi.fn();
const mockSetSessionDjState = vi.fn();
vi.mock('../../src/services/dj-state-store.js', () => ({
  getSessionDjState: (...args: unknown[]) => mockGetSessionDjState(...args),
  setSessionDjState: (...args: unknown[]) => mockSetSessionDjState(...args),
  removeSessionDjState: vi.fn(),
}));

const mockRedealCard = vi.fn();
vi.mock('../../src/services/card-dealer.js', () => ({
  dealCard: vi.fn(),
  redealCard: (...args: unknown[]) => mockRedealCard(...args),
  clearDealtCards: vi.fn(),
}));

const mockBroadcastCardDealt = vi.fn();
vi.mock('../../src/services/dj-broadcaster.js', () => ({
  broadcastDjState: vi.fn(),
  broadcastDjPause: vi.fn(),
  broadcastDjResume: vi.fn(),
  broadcastCeremonyAnticipation: vi.fn(),
  broadcastCeremonyReveal: vi.fn(),
  broadcastCeremonyQuick: vi.fn(),
  broadcastCardDealt: (...args: unknown[]) => mockBroadcastCardDealt(...args),
}));

const mockRecordActivity = vi.fn();
vi.mock('../../src/services/activity-tracker.js', () => ({
  recordActivity: (...args: unknown[]) => mockRecordActivity(...args),
  removeSession: vi.fn(),
  clearAll: vi.fn(),
}));

const mockAppendEvent = vi.fn();
vi.mock('../../src/services/event-stream.js', () => ({
  appendEvent: (...args: unknown[]) => mockAppendEvent(...args),
}));

vi.mock('../../src/dj-engine/serializer.js', () => ({
  serializeDJContext: vi.fn().mockReturnValue({}),
}));

const mockPersistDjState = vi.fn();
const mockProcessDjTransition = vi.fn().mockResolvedValue({ newContext: {}, sideEffects: [] });
const mockRecordParticipationAction = vi.fn().mockResolvedValue(null);
const mockIncrementCardAccepted = vi.fn();
vi.mock('../../src/services/session-manager.js', () => ({
  persistDjState: (...args: unknown[]) => mockPersistDjState(...args),
  processDjTransition: (...args: unknown[]) => mockProcessDjTransition(...args),
  recordParticipationAction: (...args: unknown[]) => mockRecordParticipationAction(...args),
  incrementCardAccepted: (...args: unknown[]) => mockIncrementCardAccepted(...args),
}));

const mockValidateHost = vi.fn();
vi.mock('../../src/socket-handlers/host-handlers.js', () => ({
  validateHost: (...args: unknown[]) => mockValidateHost(...args),
  registerHostHandlers: vi.fn(),
}));

const mockGetActiveConnections = vi.fn();
vi.mock('../../src/services/connection-tracker.js', () => ({
  trackConnection: vi.fn(),
  trackDisconnection: vi.fn(),
  getActiveConnections: (...args: unknown[]) => mockGetActiveConnections(...args),
  getActiveCount: vi.fn(),
  isUserConnected: vi.fn(),
  getLongestConnected: vi.fn(),
  removeDisconnectedEntry: vi.fn(),
  removeSession: vi.fn(),
  updateHostStatus: vi.fn(),
}));

const mockSelectGroupParticipants = vi.fn();
vi.mock('../../src/services/group-card-selector.js', () => ({
  selectGroupParticipants: (...args: unknown[]) => mockSelectGroupParticipants(...args),
}));

vi.mock('../../src/services/timer-scheduler.js', () => ({
  scheduleSessionTimer: vi.fn(),
  cancelSessionTimer: vi.fn(),
  pauseSessionTimer: vi.fn(),
  resumeSessionTimer: vi.fn(),
}));

function createMockSocket(overrides: Partial<{ userId: string; sessionId: string; displayName: string }> = {}) {
  const handlers = new Map<string, (data?: unknown) => Promise<void>>();
  const emittedToRoom: Array<{ room: string; event: string; data: unknown }> = [];
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
    },
    handlers,
    emittedToRoom,
  };
}

function createMockIo() {
  const emittedToRoom: Array<{ room: string; event: string; data: unknown }> = [];
  return {
    io: {
      to: (target: string) => ({
        emit: (event: string, data: unknown) => emittedToRoom.push({ room: target, event, data }),
      }),
    },
    emittedToRoom,
  };
}

const testCardMetadata = {
  currentCard: {
    id: 'chipmunk-mode',
    title: 'Chipmunk Mode',
    description: 'High pitch',
    type: 'vocal',
    emoji: '🐿️',
  },
  redrawUsed: false,
};

describe('card-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('card:accepted', () => {
    it('rejects if not in partyCardDeal state', async () => {
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'song' as never,
        currentPerformer: 'user-1',
        metadata: testCardMetadata,
      });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
      registerCardHandlers(socket as never, io as never);

      await handlers.get('card:accepted')!({ cardId: 'chipmunk-mode' });

      expect(mockRecordParticipationAction).not.toHaveBeenCalled();
      expect(mockProcessDjTransition).not.toHaveBeenCalled();
    });

    it('rejects if user is not the current performer (singer guard)', async () => {
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'partyCardDeal' as never,
        currentPerformer: 'other-user',
        metadata: testCardMetadata,
      });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
      registerCardHandlers(socket as never, io as never);

      await handlers.get('card:accepted')!({ cardId: 'chipmunk-mode' });

      expect(mockRecordParticipationAction).not.toHaveBeenCalled();
      expect(mockProcessDjTransition).not.toHaveBeenCalled();
    });

    it('rejects if cardId does not match current card', async () => {
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'partyCardDeal' as never,
        currentPerformer: 'user-1',
        metadata: testCardMetadata,
      });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
      registerCardHandlers(socket as never, io as never);

      await handlers.get('card:accepted')!({ cardId: 'wrong-card-id' });

      expect(mockRecordParticipationAction).not.toHaveBeenCalled();
    });

    describe('valid acceptance', () => {
      beforeEach(() => {
        const context = createTestDJContext({
          sessionId: 'session-1',
          state: 'partyCardDeal' as never,
          currentPerformer: 'user-1',
          metadata: testCardMetadata,
        });
        mockGetSessionDjState.mockReturnValue(context);
      });

      it('records participation scoring at engaged tier', async () => {
        const { socket, handlers } = createMockSocket();
        const { io } = createMockIo();

        const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
        registerCardHandlers(socket as never, io as never);

        await handlers.get('card:accepted')!({ cardId: 'chipmunk-mode' });

        expect(mockRecordParticipationAction).toHaveBeenCalledWith('session-1', 'user-1', 'card:accepted');
      });

      it('increments card accepted count', async () => {
        const { socket, handlers } = createMockSocket();
        const { io } = createMockIo();

        const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
        registerCardHandlers(socket as never, io as never);

        await handlers.get('card:accepted')!({ cardId: 'chipmunk-mode' });

        expect(mockIncrementCardAccepted).toHaveBeenCalledWith('session-1');
      });

      it('broadcasts card:accepted to session room', async () => {
        const { socket, handlers } = createMockSocket();
        const { io, emittedToRoom } = createMockIo();

        const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
        registerCardHandlers(socket as never, io as never);

        await handlers.get('card:accepted')!({ cardId: 'chipmunk-mode' });

        expect(emittedToRoom).toContainEqual({
          room: 'session-1',
          event: 'card:accepted',
          data: expect.objectContaining({
            cardId: 'chipmunk-mode',
            cardTitle: 'Chipmunk Mode',
            cardType: 'vocal',
            singerName: 'Test User',
          }),
        });
      });

      it('updates DJ context metadata with cardAccepted: true', async () => {
        const { socket, handlers } = createMockSocket();
        const { io } = createMockIo();

        const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
        registerCardHandlers(socket as never, io as never);

        await handlers.get('card:accepted')!({ cardId: 'chipmunk-mode' });

        expect(mockSetSessionDjState).toHaveBeenCalledWith(
          'session-1',
          expect.objectContaining({
            metadata: expect.objectContaining({
              cardAccepted: true,
              acceptedCardId: 'chipmunk-mode',
            }),
          }),
        );
      });

      it('logs card:accepted event to event stream', async () => {
        const { socket, handlers } = createMockSocket();
        const { io } = createMockIo();

        const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
        registerCardHandlers(socket as never, io as never);

        await handlers.get('card:accepted')!({ cardId: 'chipmunk-mode' });

        expect(mockAppendEvent).toHaveBeenCalledWith(
          'session-1',
          expect.objectContaining({
            type: 'card:accepted',
            userId: 'user-1',
            data: { cardId: 'chipmunk-mode', cardType: 'vocal' },
          }),
        );
      });

      it('triggers CARD_DONE transition', async () => {
        const { socket, handlers } = createMockSocket();
        const { io } = createMockIo();

        const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
        registerCardHandlers(socket as never, io as never);

        await handlers.get('card:accepted')!({ cardId: 'chipmunk-mode' });

        expect(mockProcessDjTransition).toHaveBeenCalledWith(
          'session-1',
          expect.objectContaining({
            metadata: expect.objectContaining({ cardAccepted: true }),
          }),
          { type: 'CARD_DONE' },
        );
      });
    });
  });

    describe('group card acceptance', () => {
      const groupCardMetadata = {
        currentCard: {
          id: 'tag-team',
          title: 'Tag Team',
          description: 'A random participant joins you',
          type: 'group',
          emoji: '🏷️',
        },
        redrawUsed: false,
      };

      const mockConnections = [
        { socketId: 's1', userId: 'user-1', displayName: 'Test User', connectedAt: 1, isHost: false },
        { socketId: 's2', userId: 'user-2', displayName: 'Bob', connectedAt: 2, isHost: false },
        { socketId: 's3', userId: 'user-3', displayName: 'Carol', connectedAt: 3, isHost: true },
      ];

      const mockSelection = {
        selectedUserIds: ['user-2'],
        selectedDisplayNames: ['Bob'],
        cardId: 'tag-team',
        announcement: 'TAG TEAM: Bob takes over at the chorus!',
      };

      beforeEach(() => {
        const context = createTestDJContext({
          sessionId: 'session-1',
          state: 'partyCardDeal' as never,
          currentPerformer: 'user-1',
          metadata: groupCardMetadata,
        });
        mockGetSessionDjState.mockReturnValue(context);
        mockGetActiveConnections.mockReturnValue(mockConnections);
        mockSelectGroupParticipants.mockReturnValue(mockSelection);
      });

      it('emits CARD_GROUP_ACTIVATED event for group card', async () => {
        const { socket, handlers } = createMockSocket();
        const { io, emittedToRoom } = createMockIo();

        const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
        registerCardHandlers(socket as never, io as never);

        await handlers.get('card:accepted')!({ cardId: 'tag-team' });

        expect(emittedToRoom).toContainEqual({
          room: 'session-1',
          event: 'card:groupActivated',
          data: expect.objectContaining({
            cardId: 'tag-team',
            cardType: 'group',
            announcement: 'TAG TEAM: Bob takes over at the chorus!',
            selectedUserIds: ['user-2'],
            selectedDisplayNames: ['Bob'],
            singerName: 'Test User',
          }),
        });
      });

      it('persists groupCardSelection in DJ context metadata', async () => {
        const { socket, handlers } = createMockSocket();
        const { io } = createMockIo();

        const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
        registerCardHandlers(socket as never, io as never);

        await handlers.get('card:accepted')!({ cardId: 'tag-team' });

        // Second call to setSessionDjState (after group selection)
        const secondCall = mockSetSessionDjState.mock.calls[1];
        expect(secondCall).toBeDefined();
        expect(secondCall[1].metadata.groupCardSelection).toEqual(mockSelection);
      });

      it('logs card:groupActivated to event stream', async () => {
        const { socket, handlers } = createMockSocket();
        const { io } = createMockIo();

        const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
        registerCardHandlers(socket as never, io as never);

        await handlers.get('card:accepted')!({ cardId: 'tag-team' });

        expect(mockAppendEvent).toHaveBeenCalledWith(
          'session-1',
          expect.objectContaining({
            type: 'card:groupActivated',
            userId: 'user-1',
            data: {
              cardId: 'tag-team',
              selectedUserIds: ['user-2'],
              announcement: 'TAG TEAM: Bob takes over at the chorus!',
            },
          }),
        );
      });

      it('does NOT emit CARD_GROUP_ACTIVATED for non-group card', async () => {
        const context = createTestDJContext({
          sessionId: 'session-1',
          state: 'partyCardDeal' as never,
          currentPerformer: 'user-1',
          metadata: testCardMetadata, // vocal card
        });
        mockGetSessionDjState.mockReturnValue(context);

        const { socket, handlers } = createMockSocket();
        const { io, emittedToRoom } = createMockIo();

        const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
        registerCardHandlers(socket as never, io as never);

        await handlers.get('card:accepted')!({ cardId: 'chipmunk-mode' });

        const groupEvents = emittedToRoom.filter(e => e.event === 'card:groupActivated');
        expect(groupEvents).toHaveLength(0);
        expect(mockSelectGroupParticipants).not.toHaveBeenCalled();
      });

      it('works with minimal participants (exactly 3)', async () => {
        const { socket, handlers } = createMockSocket();
        const { io, emittedToRoom } = createMockIo();

        const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
        registerCardHandlers(socket as never, io as never);

        await handlers.get('card:accepted')!({ cardId: 'tag-team' });

        // Verify selectGroupParticipants was called with correct args
        expect(mockSelectGroupParticipants).toHaveBeenCalledWith(
          'tag-team',
          'user-1',
          mockConnections,
        );
        expect(emittedToRoom.some(e => e.event === 'card:groupActivated')).toBe(true);
      });
    });

  describe('card:dismissed', () => {
    it('rejects if not in partyCardDeal state', async () => {
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'song' as never,
        currentPerformer: 'user-1',
        metadata: testCardMetadata,
      });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
      registerCardHandlers(socket as never, io as never);

      await handlers.get('card:dismissed')!({ cardId: 'chipmunk-mode' });

      expect(mockProcessDjTransition).not.toHaveBeenCalled();
    });

    it('rejects non-singer (singer guard)', async () => {
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'partyCardDeal' as never,
        currentPerformer: 'other-user',
        metadata: testCardMetadata,
      });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
      registerCardHandlers(socket as never, io as never);

      await handlers.get('card:dismissed')!({ cardId: 'chipmunk-mode' });

      expect(mockProcessDjTransition).not.toHaveBeenCalled();
    });

    describe('valid dismissal', () => {
      beforeEach(() => {
        const context = createTestDJContext({
          sessionId: 'session-1',
          state: 'partyCardDeal' as never,
          currentPerformer: 'user-1',
          metadata: testCardMetadata,
        });
        mockGetSessionDjState.mockReturnValue(context);
      });

      it('does NOT record participation scoring', async () => {
        const { socket, handlers } = createMockSocket();
        const { io } = createMockIo();

        const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
        registerCardHandlers(socket as never, io as never);

        await handlers.get('card:dismissed')!({ cardId: 'chipmunk-mode' });

        expect(mockRecordParticipationAction).not.toHaveBeenCalled();
      });

      it('updates metadata with cardAccepted: false', async () => {
        const { socket, handlers } = createMockSocket();
        const { io } = createMockIo();

        const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
        registerCardHandlers(socket as never, io as never);

        await handlers.get('card:dismissed')!({ cardId: 'chipmunk-mode' });

        expect(mockSetSessionDjState).toHaveBeenCalledWith(
          'session-1',
          expect.objectContaining({
            metadata: expect.objectContaining({
              cardAccepted: false,
              acceptedCardId: null,
            }),
          }),
        );
      });

      it('logs card:dismissed to event stream', async () => {
        const { socket, handlers } = createMockSocket();
        const { io } = createMockIo();

        const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
        registerCardHandlers(socket as never, io as never);

        await handlers.get('card:dismissed')!({ cardId: 'chipmunk-mode' });

        expect(mockAppendEvent).toHaveBeenCalledWith(
          'session-1',
          expect.objectContaining({
            type: 'card:dismissed',
            userId: 'user-1',
            data: { cardId: 'chipmunk-mode', cardType: 'vocal' },
          }),
        );
      });

      it('triggers CARD_DONE transition', async () => {
        const { socket, handlers } = createMockSocket();
        const { io } = createMockIo();

        const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
        registerCardHandlers(socket as never, io as never);

        await handlers.get('card:dismissed')!({ cardId: 'chipmunk-mode' });

        expect(mockProcessDjTransition).toHaveBeenCalledWith(
          'session-1',
          expect.objectContaining({
            metadata: expect.objectContaining({ cardAccepted: false }),
          }),
          { type: 'CARD_DONE' },
        );
      });
    });
  });

  describe('card:shared', () => {
    it('appends card:shared event with type setlist_poster', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
      registerCardHandlers(socket as never, io as never);

      await handlers.get('card:shared')!({ type: 'setlist_poster', timestamp: 1234567890 });

      expect(mockAppendEvent).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'card:shared',
          userId: 'user-1',
          data: { type: 'setlist_poster' },
        }),
      );
    });

    it('appends card:shared event with type moment (backward compat)', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
      registerCardHandlers(socket as never, io as never);

      await handlers.get('card:shared')!({ type: 'moment', timestamp: 1234567890 });

      expect(mockAppendEvent).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          type: 'card:shared',
          userId: 'user-1',
          data: { type: 'moment' },
        }),
      );
    });

    it('rejects payload with missing type', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
      registerCardHandlers(socket as never, io as never);

      await handlers.get('card:shared')!({ timestamp: 1234567890 });

      expect(mockAppendEvent).not.toHaveBeenCalled();
    });

    it('rejects payload with empty type', async () => {
      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
      registerCardHandlers(socket as never, io as never);

      await handlers.get('card:shared')!({ type: '', timestamp: 1234567890 });

      expect(mockAppendEvent).not.toHaveBeenCalled();
    });

    it('rejects when sessionId is missing', async () => {
      const handlers = new Map<string, (data?: unknown) => Promise<void>>();
      const socket = {
        data: { userId: 'user-1', role: 'authenticated' as const, displayName: 'Test User' },
        on: (event: string, handler: (data?: unknown) => Promise<void>) => {
          handlers.set(event, handler);
        },
      };
      const { io } = createMockIo();

      const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
      registerCardHandlers(socket as never, io as never);

      await handlers.get('card:shared')!({ type: 'setlist_poster', timestamp: 1234567890 });

      expect(mockAppendEvent).not.toHaveBeenCalled();
    });
  });

  describe('card:redraw', () => {
    it('allows host to redraw (existing behavior)', async () => {
      mockValidateHost.mockResolvedValue(undefined);
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'partyCardDeal' as never,
        participantCount: 5,
        currentPerformer: 'other-user',
        metadata: testCardMetadata,
      });
      mockGetSessionDjState.mockReturnValue(context);
      mockRedealCard.mockReturnValue({
        id: 'robot-mode', title: 'Robot Mode', description: 'Sing like a robot',
        type: 'vocal', emoji: '🤖', minParticipants: 1,
      });

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
      registerCardHandlers(socket as never, io as never);

      await handlers.get('card:redraw')!();

      expect(mockRedealCard).toHaveBeenCalled();
      expect(mockBroadcastCardDealt).toHaveBeenCalled();
    });

    it('allows singer to redraw when redrawUsed is false', async () => {
      mockValidateHost.mockRejectedValue(new Error('Not host'));
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'partyCardDeal' as never,
        participantCount: 5,
        currentPerformer: 'user-1',
        metadata: testCardMetadata,
      });
      mockGetSessionDjState.mockReturnValue(context);
      mockRedealCard.mockReturnValue({
        id: 'robot-mode', title: 'Robot Mode', description: 'Sing like a robot',
        type: 'vocal', emoji: '🤖', minParticipants: 1,
      });

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
      registerCardHandlers(socket as never, io as never);

      await handlers.get('card:redraw')!();

      expect(mockRedealCard).toHaveBeenCalled();
    });

    it('blocks singer redraw when redrawUsed is true', async () => {
      mockValidateHost.mockRejectedValue(new Error('Not host'));
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'partyCardDeal' as never,
        currentPerformer: 'user-1',
        metadata: { ...testCardMetadata, redrawUsed: true },
      });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
      registerCardHandlers(socket as never, io as never);

      await handlers.get('card:redraw')!();

      expect(mockRedealCard).not.toHaveBeenCalled();
    });

    it('rejects non-host non-singer', async () => {
      mockValidateHost.mockRejectedValue(new Error('Not host'));
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'partyCardDeal' as never,
        currentPerformer: 'other-user',
        metadata: testCardMetadata,
      });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
      registerCardHandlers(socket as never, io as never);

      await handlers.get('card:redraw')!();

      expect(mockRedealCard).not.toHaveBeenCalled();
    });

    it('sets redrawUsed to true when singer redraws', async () => {
      mockValidateHost.mockRejectedValue(new Error('Not host'));
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'partyCardDeal' as never,
        participantCount: 5,
        currentPerformer: 'user-1',
        metadata: testCardMetadata,
      });
      mockGetSessionDjState.mockReturnValue(context);
      mockRedealCard.mockReturnValue({
        id: 'robot-mode', title: 'Robot Mode', description: 'Sing like a robot',
        type: 'vocal', emoji: '🤖', minParticipants: 1,
      });

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
      registerCardHandlers(socket as never, io as never);

      await handlers.get('card:redraw')!();

      expect(mockSetSessionDjState).toHaveBeenCalledWith(
        'session-1',
        expect.objectContaining({
          metadata: expect.objectContaining({
            redrawUsed: true,
          }),
        }),
      );
    });

    it('only fires during partyCardDeal state', async () => {
      mockValidateHost.mockResolvedValue(undefined);
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'song' as never,
        metadata: { currentCard: { id: 'test-card' } },
      });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
      registerCardHandlers(socket as never, io as never);

      await handlers.get('card:redraw')!();

      expect(mockRedealCard).not.toHaveBeenCalled();
    });

    describe('valid host re-deal', () => {
      const newCard = {
        id: 'robot-mode',
        title: 'Robot Mode',
        description: 'Sing like a robot',
        type: 'vocal',
        emoji: '🤖',
        minParticipants: 1,
      };

      beforeEach(() => {
        mockValidateHost.mockResolvedValue(undefined);
        const context = createTestDJContext({
          sessionId: 'session-1',
          state: 'partyCardDeal' as never,
          participantCount: 5,
          metadata: testCardMetadata,
        });
        mockGetSessionDjState.mockReturnValue(context);
        mockRedealCard.mockReturnValue(newCard);
      });

      it('broadcasts new card:dealt event', async () => {
        const { socket, handlers } = createMockSocket();
        const { io } = createMockIo();

        const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
        registerCardHandlers(socket as never, io as never);

        await handlers.get('card:redraw')!();

        expect(mockBroadcastCardDealt).toHaveBeenCalledWith('session-1', {
          cardId: 'robot-mode',
          title: 'Robot Mode',
          description: 'Sing like a robot',
          cardType: 'vocal',
          emoji: '🤖',
        });
      });

      it('updates DJ context metadata with new card', async () => {
        const { socket, handlers } = createMockSocket();
        const { io } = createMockIo();

        const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
        registerCardHandlers(socket as never, io as never);

        await handlers.get('card:redraw')!();

        expect(mockSetSessionDjState).toHaveBeenCalledWith(
          'session-1',
          expect.objectContaining({
            metadata: expect.objectContaining({
              currentCard: {
                id: 'robot-mode',
                title: 'Robot Mode',
                description: 'Sing like a robot',
                type: 'vocal',
                emoji: '🤖',
              },
            }),
          }),
        );
      });

      it('calls appendEvent with card:redealt event', async () => {
        const { socket, handlers } = createMockSocket();
        const { io } = createMockIo();

        const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
        registerCardHandlers(socket as never, io as never);

        await handlers.get('card:redraw')!();

        expect(mockAppendEvent).toHaveBeenCalledWith(
          'session-1',
          expect.objectContaining({
            type: 'card:redealt',
            userId: 'user-1',
            data: { previousCardId: 'chipmunk-mode', newCardId: 'robot-mode' },
          }),
        );
      });
    });
  });
});
