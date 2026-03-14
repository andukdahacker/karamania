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
vi.mock('../../src/services/session-manager.js', () => ({
  persistDjState: (...args: unknown[]) => mockPersistDjState(...args),
  recordParticipationAction: vi.fn(),
}));

const mockValidateHost = vi.fn();
vi.mock('../../src/socket-handlers/host-handlers.js', () => ({
  validateHost: (...args: unknown[]) => mockValidateHost(...args),
  registerHostHandlers: vi.fn(),
}));

vi.mock('../../src/services/timer-scheduler.js', () => ({
  scheduleSessionTimer: vi.fn(),
  cancelSessionTimer: vi.fn(),
  pauseSessionTimer: vi.fn(),
  resumeSessionTimer: vi.fn(),
}));

function createMockSocket(overrides: Partial<{ userId: string; sessionId: string }> = {}) {
  const handlers = new Map<string, (data?: unknown) => Promise<void>>();
  return {
    socket: {
      data: {
        userId: overrides.userId ?? 'user-1',
        sessionId: overrides.sessionId ?? 'session-1',
        role: 'authenticated' as const,
        displayName: 'Test User',
      },
      on: (event: string, handler: (data?: unknown) => Promise<void>) => {
        handlers.set(event, handler);
      },
    },
    handlers,
  };
}

function createMockIo() {
  return {
    io: {
      to: () => ({ emit: vi.fn() }),
    },
  };
}

describe('card-handlers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('card:redraw', () => {
    it('validates host via validateHost', async () => {
      mockValidateHost.mockRejectedValue(new Error('Not host'));

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
      registerCardHandlers(socket as never, io as never);

      await handlers.get('card:redraw')!();

      expect(mockValidateHost).toHaveBeenCalledWith(socket);
      expect(mockRedealCard).not.toHaveBeenCalled();
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

    it('returns early if no current card in metadata', async () => {
      mockValidateHost.mockResolvedValue(undefined);
      const context = createTestDJContext({
        sessionId: 'session-1',
        state: 'partyCardDeal' as never,
        metadata: {},
      });
      mockGetSessionDjState.mockReturnValue(context);

      const { socket, handlers } = createMockSocket();
      const { io } = createMockIo();

      const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
      registerCardHandlers(socket as never, io as never);

      await handlers.get('card:redraw')!();

      expect(mockRedealCard).not.toHaveBeenCalled();
    });

    it('returns early if sessionId is missing', async () => {
      mockValidateHost.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket();
      socket.data.sessionId = '';
      const { io } = createMockIo();

      const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
      registerCardHandlers(socket as never, io as never);

      await handlers.get('card:redraw')!();

      expect(mockGetSessionDjState).not.toHaveBeenCalled();
    });

    it('returns early if userId is missing', async () => {
      mockValidateHost.mockResolvedValue(undefined);

      const { socket, handlers } = createMockSocket();
      socket.data.userId = '';
      const { io } = createMockIo();

      const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
      registerCardHandlers(socket as never, io as never);

      await handlers.get('card:redraw')!();

      expect(mockGetSessionDjState).not.toHaveBeenCalled();
    });

    describe('valid re-deal', () => {
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
          metadata: {
            currentCard: {
              id: 'chipmunk-mode',
              title: 'Chipmunk Mode',
              description: 'High pitch',
              type: 'vocal',
              emoji: '🐿️',
            },
          },
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

      it('calls persistDjState with updated context', async () => {
        const { socket, handlers } = createMockSocket();
        const { io } = createMockIo();

        const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
        registerCardHandlers(socket as never, io as never);

        await handlers.get('card:redraw')!();

        expect(mockPersistDjState).toHaveBeenCalled();
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

      it('calls recordActivity', async () => {
        const { socket, handlers } = createMockSocket();
        const { io } = createMockIo();

        const { registerCardHandlers } = await import('../../src/socket-handlers/card-handlers.js');
        registerCardHandlers(socket as never, io as never);

        await handlers.get('card:redraw')!();

        expect(mockRecordActivity).toHaveBeenCalledWith('session-1');
      });
    });
  });
});
