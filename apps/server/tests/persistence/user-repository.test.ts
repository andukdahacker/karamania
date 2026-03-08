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
