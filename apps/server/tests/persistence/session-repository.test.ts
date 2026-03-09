import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestSession } from '../factories/session.js';
import { createTestParticipant } from '../factories/participant.js';
import { createTestUser } from '../factories/user.js';

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

const mockExecuteTakeFirst = vi.fn();
const mockExecuteTakeFirstOrThrow = vi.fn();
const mockExecute = vi.fn();
const mockWhere = vi.fn();
const mockValues = vi.fn();
const mockSet = vi.fn();

const mockLeftJoin = vi.fn();
const mockSelect = vi.fn();
const mockOrderBy = vi.fn();

vi.mock('../../src/db/connection.js', () => {
  const createWhereChain = () => ({
    where: (...args: unknown[]) => {
      mockWhere(...args);
      return {
        executeTakeFirst: mockExecuteTakeFirst,
        execute: mockExecute,
        where: (...innerArgs: unknown[]) => {
          mockWhere(...innerArgs);
          return { executeTakeFirst: mockExecuteTakeFirst };
        },
      };
    },
    executeTakeFirst: mockExecuteTakeFirst,
  });

  const createSelectChain = () => ({
    where: (...args: unknown[]) => {
      mockWhere(...args);
      return {
        orderBy: (...orderArgs: unknown[]) => {
          mockOrderBy(...orderArgs);
          return { execute: mockExecute };
        },
      };
    },
  });

  const createInsertChain = () => ({
    values: (...args: unknown[]) => {
      mockValues(...args);
      return {
        returningAll: () => ({
          executeTakeFirstOrThrow: mockExecuteTakeFirstOrThrow,
        }),
      };
    },
  });

  const createUpdateChain = () => ({
    set: (...args: unknown[]) => {
      mockSet(...args);
      return {
        where: (...whereArgs: unknown[]) => {
          mockWhere(...whereArgs);
          return { execute: mockExecute, executeTakeFirst: mockExecuteTakeFirst };
        },
      };
    },
  });

  return {
    db: {
      selectFrom: vi.fn().mockReturnValue({
        selectAll: () => createWhereChain(),
        leftJoin: (...args: unknown[]) => {
          mockLeftJoin(...args);
          return {
            select: (...selectArgs: unknown[]) => {
              mockSelect(...selectArgs);
              return createSelectChain();
            },
          };
        },
      }),
      insertInto: vi.fn().mockReturnValue(createInsertChain()),
      updateTable: vi.fn().mockReturnValue(createUpdateChain()),
    },
  };
});

describe('session-repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findByPartyCode', () => {
    it('returns active session', async () => {
      const testSession = createTestSession({ party_code: 'VIBE', status: 'lobby' });
      mockExecuteTakeFirst.mockResolvedValue(testSession);

      const { findByPartyCode } = await import('../../src/persistence/session-repository.js');
      const result = await findByPartyCode('VIBE');

      expect(mockWhere).toHaveBeenCalledWith('party_code', '=', 'VIBE');
      expect(mockWhere).toHaveBeenCalledWith('status', '!=', 'ended');
      expect(result).toEqual(testSession);
    });

    it('returns undefined when no active session found', async () => {
      mockExecuteTakeFirst.mockResolvedValue(undefined);

      const { findByPartyCode } = await import('../../src/persistence/session-repository.js');
      const result = await findByPartyCode('NOPE');

      expect(result).toBeUndefined();
    });
  });

  describe('create', () => {
    it('inserts session and returns it with status lobby', async () => {
      const testUser = createTestUser();
      const testSession = createTestSession({
        host_user_id: testUser.id,
        party_code: 'ABCD',
        vibe: 'general',
        status: 'lobby',
      });
      mockExecuteTakeFirstOrThrow.mockResolvedValue(testSession);

      const { create } = await import('../../src/persistence/session-repository.js');
      const result = await create({
        hostUserId: testUser.id,
        partyCode: 'ABCD',
        vibe: 'general',
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          host_user_id: testUser.id,
          party_code: 'ABCD',
          vibe: 'general',
          status: 'lobby',
        })
      );
      expect(result).toEqual(testSession);
      expect(result.status).toBe('lobby');
    });

    it('creates session with vibe set', async () => {
      const testUser = createTestUser();
      const testSession = createTestSession({
        host_user_id: testUser.id,
        vibe: 'rock',
      });
      mockExecuteTakeFirstOrThrow.mockResolvedValue(testSession);

      const { create } = await import('../../src/persistence/session-repository.js');
      const result = await create({
        hostUserId: testUser.id,
        partyCode: 'ROCK',
        vibe: 'rock',
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({ vibe: 'rock' })
      );
      expect(result.vibe).toBe('rock');
    });
  });

  describe('addParticipant', () => {
    it('inserts participant record', async () => {
      const testParticipant = createTestParticipant({
        session_id: 'session-1',
        user_id: 'user-1',
      });
      mockExecuteTakeFirstOrThrow.mockResolvedValue(testParticipant);

      const { addParticipant } = await import('../../src/persistence/session-repository.js');
      const result = await addParticipant({
        sessionId: 'session-1',
        userId: 'user-1',
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          session_id: 'session-1',
          user_id: 'user-1',
        })
      );
      expect(result).toEqual(testParticipant);
    });
  });

  describe('updateVibe', () => {
    it('updates vibe column', async () => {
      mockExecute.mockResolvedValue(undefined);

      const { updateVibe } = await import('../../src/persistence/session-repository.js');
      await updateVibe('session-1', 'kpop');

      expect(mockSet).toHaveBeenCalledWith({ vibe: 'kpop' });
      expect(mockWhere).toHaveBeenCalledWith('id', '=', 'session-1');
    });
  });

  describe('getParticipants', () => {
    it('queries session_participants with left join on users and orders by joined_at asc', async () => {
      const participants = [
        { id: 'p1', user_id: 'user-1', guest_name: null, display_name: 'Host', joined_at: new Date('2026-03-01') },
        { id: 'p2', user_id: null, guest_name: 'Alice', display_name: null, joined_at: new Date('2026-03-02') },
      ];
      mockExecute.mockResolvedValue(participants);

      const { getParticipants } = await import('../../src/persistence/session-repository.js');
      const result = await getParticipants('session-1');

      expect(mockLeftJoin).toHaveBeenCalledWith('users', 'users.id', 'session_participants.user_id');
      expect(mockSelect).toHaveBeenCalledWith([
        'session_participants.id',
        'session_participants.user_id',
        'session_participants.guest_name',
        'users.display_name',
        'session_participants.joined_at',
      ]);
      expect(mockWhere).toHaveBeenCalledWith('session_participants.session_id', '=', 'session-1');
      expect(mockOrderBy).toHaveBeenCalledWith('session_participants.joined_at', 'asc');
      expect(result).toEqual(participants);
    });

    it('returns empty array when no participants exist', async () => {
      mockExecute.mockResolvedValue([]);

      const { getParticipants } = await import('../../src/persistence/session-repository.js');
      const result = await getParticipants('session-empty');

      expect(result).toEqual([]);
    });
  });

  describe('addParticipantIfNotExists', () => {
    it('does not throw on unique constraint violation', async () => {
      const error = new Error('duplicate key value violates unique constraint') as Error & { code: string };
      error.code = '23505';
      mockExecuteTakeFirstOrThrow.mockRejectedValue(error);

      const { addParticipantIfNotExists } = await import('../../src/persistence/session-repository.js');

      await expect(
        addParticipantIfNotExists({ sessionId: 'session-1', guestName: 'Alice' })
      ).resolves.toBeUndefined();
    });

    it('throws on non-unique-constraint errors', async () => {
      const error = new Error('connection error') as Error & { code: string };
      error.code = '08001';
      mockExecuteTakeFirstOrThrow.mockRejectedValue(error);

      const { addParticipantIfNotExists } = await import('../../src/persistence/session-repository.js');

      await expect(
        addParticipantIfNotExists({ sessionId: 'session-1', guestName: 'Bob' })
      ).rejects.toThrow('connection error');
    });
  });

  describe('findById', () => {
    it('returns session when found', async () => {
      const testSession = createTestSession();
      mockExecuteTakeFirst.mockResolvedValue(testSession);

      const { findById } = await import('../../src/persistence/session-repository.js');
      const result = await findById(testSession.id);

      expect(mockWhere).toHaveBeenCalledWith('id', '=', testSession.id);
      expect(result).toEqual(testSession);
    });

    it('returns undefined when not found', async () => {
      mockExecuteTakeFirst.mockResolvedValue(undefined);

      const { findById } = await import('../../src/persistence/session-repository.js');
      const result = await findById('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('updateStatus', () => {
    it('updates session status in DB', async () => {
      mockExecuteTakeFirst.mockResolvedValue({ id: 'session-1', status: 'active' });

      const { updateStatus } = await import('../../src/persistence/session-repository.js');
      const result = await updateStatus('session-1', 'active');

      expect(mockSet).toHaveBeenCalledWith({ status: 'active' });
      expect(mockWhere).toHaveBeenCalledWith('id', '=', 'session-1');
      expect(result).toEqual({ id: 'session-1', status: 'active' });
    });

    it('on non-existent session returns no result', async () => {
      mockExecuteTakeFirst.mockResolvedValue(undefined);

      const { updateStatus } = await import('../../src/persistence/session-repository.js');
      const result = await updateStatus('nonexistent-session', 'active');

      expect(mockSet).toHaveBeenCalledWith({ status: 'active' });
      expect(mockWhere).toHaveBeenCalledWith('id', '=', 'nonexistent-session');
      expect(result).toBeUndefined();
    });
  });

  describe('updateHost', () => {
    it('updates host_user_id', async () => {
      mockExecuteTakeFirst.mockResolvedValue({ id: 'session-1', host_user_id: 'new-host' });

      const { updateHost } = await import('../../src/persistence/session-repository.js');
      const result = await updateHost('session-1', 'new-host');

      expect(mockSet).toHaveBeenCalledWith({ host_user_id: 'new-host' });
      expect(mockWhere).toHaveBeenCalledWith('id', '=', 'session-1');
      expect(result).toEqual({ id: 'session-1', host_user_id: 'new-host' });
    });

    it('on non-existent session returns no result', async () => {
      mockExecuteTakeFirst.mockResolvedValue(undefined);

      const { updateHost } = await import('../../src/persistence/session-repository.js');
      const result = await updateHost('nonexistent-session', 'new-host');

      expect(mockSet).toHaveBeenCalledWith({ host_user_id: 'new-host' });
      expect(mockWhere).toHaveBeenCalledWith('id', '=', 'nonexistent-session');
      expect(result).toBeUndefined();
    });
  });
});
