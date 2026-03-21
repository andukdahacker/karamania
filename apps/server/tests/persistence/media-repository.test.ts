import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestMediaCapture } from '../factories/media-capture.js';

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
const mockOrderBy = vi.fn();

const mockSet = vi.fn();

const mockLimit = vi.fn();
const mockOffset = vi.fn();
const mockSelect = vi.fn();
const mockInnerJoin = vi.fn();

vi.mock('../../src/db/connection.js', () => {
  const createChain = (): Record<string, unknown> => ({
    executeTakeFirst: mockExecuteTakeFirst,
    executeTakeFirstOrThrow: mockExecuteTakeFirstOrThrow,
    execute: mockExecute,
    where: (...args: unknown[]) => { mockWhere(...args); return createChain(); },
    orderBy: (...args: unknown[]) => { mockOrderBy(...args); return createChain(); },
    limit: (...args: unknown[]) => { mockLimit(...args); return createChain(); },
    offset: (...args: unknown[]) => { mockOffset(...args); return createChain(); },
    select: (...args: unknown[]) => { mockSelect(...args); return createChain(); },
    innerJoin: (...args: unknown[]) => { mockInnerJoin(...args); return createChain(); },
    returningAll: () => createChain(),
  });

  return {
    db: {
      selectFrom: vi.fn().mockReturnValue({
        selectAll: () => createChain(),
        innerJoin: (...args: unknown[]) => { mockInnerJoin(...args); return createChain(); },
        select: (...args: unknown[]) => { mockSelect(...args); return createChain(); },
      }),
      insertInto: vi.fn().mockReturnValue({
        values: (...args: unknown[]) => {
          mockValues(...args);
          return createChain();
        },
      }),
      updateTable: vi.fn().mockReturnValue({
        set: (...args: unknown[]) => {
          mockSet(...args);
          return createChain();
        },
      }),
    },
  };
});

describe('media-repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('create', () => {
    it('inserts a media capture record and returns it', async () => {
      const capture = createTestMediaCapture();
      mockExecuteTakeFirstOrThrow.mockResolvedValue(capture);

      const { create } = await import('../../src/persistence/media-repository.js');
      const result = await create({
        id: capture.id,
        sessionId: capture.session_id,
        userId: null,
        storagePath: capture.storage_path,
        triggerType: 'manual',
        djStateAtCapture: null,
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          id: capture.id,
          session_id: capture.session_id,
          trigger_type: 'manual',
        }),
      );
      expect(result).toEqual(capture);
    });

    it('serializes djStateAtCapture as JSON', async () => {
      const capture = createTestMediaCapture();
      mockExecuteTakeFirstOrThrow.mockResolvedValue(capture);

      const { create } = await import('../../src/persistence/media-repository.js');
      const djState = { state: 'song', songCount: 3 };
      await create({
        id: capture.id,
        sessionId: capture.session_id,
        userId: 'user-1',
        storagePath: capture.storage_path,
        triggerType: 'post_ceremony',
        djStateAtCapture: djState,
      });

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          dj_state_at_capture: JSON.stringify(djState),
          user_id: 'user-1',
          trigger_type: 'post_ceremony',
        }),
      );
    });
  });

  describe('findBySessionId', () => {
    it('returns captures for a session ordered by created_at', async () => {
      const captures = [createTestMediaCapture(), createTestMediaCapture()];
      mockExecute.mockResolvedValue(captures);

      const { findBySessionId } = await import('../../src/persistence/media-repository.js');
      const result = await findBySessionId('session-1');

      expect(mockWhere).toHaveBeenCalledWith('session_id', '=', 'session-1');
      expect(mockOrderBy).toHaveBeenCalledWith('created_at', 'asc');
      expect(result).toEqual(captures);
    });
  });

  describe('findById', () => {
    it('returns a capture when found', async () => {
      const capture = createTestMediaCapture({ id: 'cap-1' });
      mockExecuteTakeFirst.mockResolvedValue(capture);

      const { findById } = await import('../../src/persistence/media-repository.js');
      const result = await findById('cap-1');

      expect(mockWhere).toHaveBeenCalledWith('id', '=', 'cap-1');
      expect(result).toEqual(capture);
    });

    it('returns undefined when not found', async () => {
      mockExecuteTakeFirst.mockResolvedValue(undefined);

      const { findById } = await import('../../src/persistence/media-repository.js');
      const result = await findById('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('relinkCaptures', () => {
    it('re-links captures by ID where user_id IS NULL', async () => {
      mockExecuteTakeFirst.mockResolvedValue({ numUpdatedRows: BigInt(2) });

      const { relinkCaptures } = await import('../../src/persistence/media-repository.js');
      const result = await relinkCaptures(['cap-1', 'cap-2'], 'user-1');

      expect(mockSet).toHaveBeenCalledWith({ user_id: 'user-1' });
      expect(mockWhere).toHaveBeenCalledWith('id', 'in', ['cap-1', 'cap-2']);
      expect(mockWhere).toHaveBeenCalledWith('user_id', 'is', null);
      expect(result).toBe(2);
    });

    it('returns 0 for empty array', async () => {
      const { relinkCaptures } = await import('../../src/persistence/media-repository.js');
      const result = await relinkCaptures([], 'user-1');

      expect(result).toBe(0);
    });

    it('returns correct count of updated rows', async () => {
      mockExecuteTakeFirst.mockResolvedValue({ numUpdatedRows: BigInt(1) });

      const { relinkCaptures } = await import('../../src/persistence/media-repository.js');
      const result = await relinkCaptures(['cap-1', 'cap-2', 'cap-3'], 'user-1');

      // Only 1 of 3 had user_id IS NULL
      expect(result).toBe(1);
    });
  });

  describe('findByUserId', () => {
    it('returns captures for a user in a session', async () => {
      const captures = [createTestMediaCapture({ user_id: 'user-1' })];
      mockExecute.mockResolvedValue(captures);

      const { findByUserId } = await import('../../src/persistence/media-repository.js');
      const result = await findByUserId('user-1', 'session-1');

      expect(mockWhere).toHaveBeenCalledWith('user_id', '=', 'user-1');
      expect(mockWhere).toHaveBeenCalledWith('session_id', '=', 'session-1');
      expect(mockOrderBy).toHaveBeenCalledWith('created_at', 'asc');
      expect(result).toEqual(captures);
    });
  });

  describe('findAllByUserId', () => {
    it('returns captures across sessions for a user', async () => {
      const captures = [
        { ...createTestMediaCapture({ user_id: 'user-1', session_id: 'sess-1' }), venue_name: 'Rock Bar', session_created_at: new Date('2026-01-01') },
        { ...createTestMediaCapture({ user_id: 'user-1', session_id: 'sess-2' }), venue_name: null, session_created_at: new Date('2026-01-02') },
      ];
      mockExecute.mockResolvedValueOnce(captures);
      mockExecuteTakeFirstOrThrow.mockResolvedValueOnce({ count: 2 });

      const { findAllByUserId } = await import('../../src/persistence/media-repository.js');
      const result = await findAllByUserId('user-1');

      expect(mockInnerJoin).toHaveBeenCalledWith('sessions', 'sessions.id', 'media_captures.session_id');
      expect(mockWhere).toHaveBeenCalledWith('media_captures.user_id', '=', 'user-1');
      expect(result.captures).toEqual(captures);
      expect(result.total).toBe(2);
    });

    it('returns empty array for user with no captures', async () => {
      mockExecute.mockResolvedValueOnce([]);
      mockExecuteTakeFirstOrThrow.mockResolvedValueOnce({ count: 0 });

      const { findAllByUserId } = await import('../../src/persistence/media-repository.js');
      const result = await findAllByUserId('user-no-captures');

      expect(result.captures).toEqual([]);
      expect(result.total).toBe(0);
    });

    it('respects limit and offset', async () => {
      mockExecute.mockResolvedValueOnce([]);
      mockExecuteTakeFirstOrThrow.mockResolvedValueOnce({ count: 0 });

      const { findAllByUserId } = await import('../../src/persistence/media-repository.js');
      await findAllByUserId('user-1', 10, 20);

      expect(mockLimit).toHaveBeenCalledWith(10);
      expect(mockOffset).toHaveBeenCalledWith(20);
    });

    it('orders by created_at desc', async () => {
      mockExecute.mockResolvedValueOnce([]);
      mockExecuteTakeFirstOrThrow.mockResolvedValueOnce({ count: 0 });

      const { findAllByUserId } = await import('../../src/persistence/media-repository.js');
      await findAllByUserId('user-1');

      expect(mockOrderBy).toHaveBeenCalledWith('media_captures.created_at', 'desc');
    });
  });
});
