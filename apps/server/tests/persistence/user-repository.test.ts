import { describe, it, expect, vi, beforeEach } from 'vitest';
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

const mockSelectAll = vi.fn();
const mockWhere = vi.fn();
const mockExecuteTakeFirst = vi.fn();
const mockExecuteTakeFirstOrThrow = vi.fn();
const mockValues = vi.fn();
const mockOnConflict = vi.fn();
const mockReturningAll = vi.fn();

const mockSet = vi.fn();
const mockExecute = vi.fn();

vi.mock('../../src/db/connection.js', () => ({
  db: {
    selectFrom: vi.fn().mockReturnValue({
      selectAll: () => ({
        where: (...args: unknown[]) => {
          mockWhere(...args);
          return { executeTakeFirst: mockExecuteTakeFirst };
        },
      }),
    }),
    insertInto: vi.fn().mockReturnValue({
      values: (...args: unknown[]) => {
        mockValues(...args);
        return {
          onConflict: (...conflictArgs: unknown[]) => {
            mockOnConflict(...conflictArgs);
            return {
              returningAll: () => ({
                executeTakeFirstOrThrow: mockExecuteTakeFirstOrThrow,
              }),
            };
          },
          returningAll: () => ({
            executeTakeFirstOrThrow: mockExecuteTakeFirstOrThrow,
          }),
        };
      },
    }),
    updateTable: vi.fn().mockReturnValue({
      set: (...args: unknown[]) => {
        mockSet(...args);
        return {
          where: (...whereArgs: unknown[]) => {
            mockWhere(...whereArgs);
            return {
              where: (...innerArgs: unknown[]) => {
                mockWhere(...innerArgs);
                return {
                  returningAll: () => ({
                    executeTakeFirstOrThrow: mockExecuteTakeFirstOrThrow,
                  }),
                };
              },
              returningAll: () => ({
                executeTakeFirstOrThrow: mockExecuteTakeFirstOrThrow,
              }),
            };
          },
        };
      },
    }),
  },
}));

describe('user-repository', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('findByFirebaseUid', () => {
    it('returns user when found', async () => {
      const testUser = createTestUser({ firebase_uid: 'fb-123' });
      mockExecuteTakeFirst.mockResolvedValue(testUser);

      const { findByFirebaseUid } = await import('../../src/persistence/user-repository.js');
      const result = await findByFirebaseUid('fb-123');

      expect(mockWhere).toHaveBeenCalledWith('firebase_uid', '=', 'fb-123');
      expect(result).toEqual(testUser);
    });

    it('returns undefined when not found', async () => {
      mockExecuteTakeFirst.mockResolvedValue(undefined);

      const { findByFirebaseUid } = await import('../../src/persistence/user-repository.js');
      const result = await findByFirebaseUid('nonexistent');

      expect(result).toBeUndefined();
    });
  });

  describe('upsertFromFirebase', () => {
    it('creates new user', async () => {
      const testUser = createTestUser({ firebase_uid: 'fb-new', display_name: 'New User' });
      mockExecuteTakeFirstOrThrow.mockResolvedValue(testUser);

      const { upsertFromFirebase } = await import('../../src/persistence/user-repository.js');
      const result = await upsertFromFirebase({
        firebaseUid: 'fb-new',
        displayName: 'New User',
      });

      expect(result).toEqual(testUser);
    });

    it('updates existing user on firebase_uid conflict', async () => {
      const updatedUser = createTestUser({ firebase_uid: 'fb-existing', display_name: 'Updated Name', avatar_url: 'https://example.com/new.jpg' });
      mockExecuteTakeFirstOrThrow.mockResolvedValue(updatedUser);

      const { upsertFromFirebase } = await import('../../src/persistence/user-repository.js');
      const result = await upsertFromFirebase({
        firebaseUid: 'fb-existing',
        displayName: 'Updated Name',
        avatarUrl: 'https://example.com/new.jpg',
      });

      expect(result).toEqual(updatedUser);
    });
  });

  describe('createGuestUser', () => {
    it('creates user with firebase_uid null', async () => {
      const guestUser = { ...createTestUser({ display_name: 'Guest Host' }), firebase_uid: null };
      mockExecuteTakeFirstOrThrow.mockResolvedValue(guestUser);

      const { createGuestUser } = await import('../../src/persistence/user-repository.js');
      const result = await createGuestUser('Guest Host');

      expect(mockValues).toHaveBeenCalledWith(
        expect.objectContaining({
          display_name: 'Guest Host',
          firebase_uid: null,
        })
      );
      expect(result).toEqual(guestUser);
      expect(result.firebase_uid).toBeNull();
    });
  });

  describe('upgradeGuestToAuthenticated', () => {
    it('upgrades guest user with firebase_uid IS NULL', async () => {
      const upgradedUser = createTestUser({ firebase_uid: 'fb-new', display_name: 'Upgraded User', avatar_url: 'https://example.com/avatar.jpg' });
      mockExecuteTakeFirstOrThrow.mockResolvedValue(upgradedUser);

      const { upgradeGuestToAuthenticated } = await import('../../src/persistence/user-repository.js');
      const result = await upgradeGuestToAuthenticated('guest-id-123', 'fb-new', 'Upgraded User', 'https://example.com/avatar.jpg');

      expect(mockSet).toHaveBeenCalledWith({
        firebase_uid: 'fb-new',
        display_name: 'Upgraded User',
        avatar_url: 'https://example.com/avatar.jpg',
      });
      expect(mockWhere).toHaveBeenCalledWith('id', '=', 'guest-id-123');
      expect(mockWhere).toHaveBeenCalledWith('firebase_uid', 'is', null);
      expect(result).toEqual(upgradedUser);
    });

    it('returns updated user with firebase_uid set', async () => {
      const upgradedUser = createTestUser({ firebase_uid: 'fb-456' });
      mockExecuteTakeFirstOrThrow.mockResolvedValue(upgradedUser);

      const { upgradeGuestToAuthenticated } = await import('../../src/persistence/user-repository.js');
      const result = await upgradeGuestToAuthenticated('guest-id', 'fb-456', 'User');

      expect(result.firebase_uid).toBe('fb-456');
    });

    it('throws if user not found or already has firebase_uid', async () => {
      mockExecuteTakeFirstOrThrow.mockRejectedValue(new Error('no result'));

      const { upgradeGuestToAuthenticated } = await import('../../src/persistence/user-repository.js');

      await expect(
        upgradeGuestToAuthenticated('nonexistent', 'fb-999', 'User')
      ).rejects.toThrow('no result');
    });

    it('sets avatar_url to null when not provided', async () => {
      const upgradedUser = createTestUser({ firebase_uid: 'fb-new', avatar_url: null });
      mockExecuteTakeFirstOrThrow.mockResolvedValue(upgradedUser);

      const { upgradeGuestToAuthenticated } = await import('../../src/persistence/user-repository.js');
      await upgradeGuestToAuthenticated('guest-id', 'fb-new', 'User');

      expect(mockSet).toHaveBeenCalledWith(
        expect.objectContaining({ avatar_url: null })
      );
    });
  });

  describe('findById', () => {
    it('returns user when found', async () => {
      const testUser = createTestUser();
      mockExecuteTakeFirst.mockResolvedValue(testUser);

      const { findById } = await import('../../src/persistence/user-repository.js');
      const result = await findById(testUser.id);

      expect(mockWhere).toHaveBeenCalledWith('id', '=', testUser.id);
      expect(result).toEqual(testUser);
    });

    it('returns undefined when not found', async () => {
      mockExecuteTakeFirst.mockResolvedValue(undefined);

      const { findById } = await import('../../src/persistence/user-repository.js');
      const result = await findById('nonexistent-id');

      expect(result).toBeUndefined();
    });
  });
});
