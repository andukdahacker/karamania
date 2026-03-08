import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestSession } from '../factories/session.js';

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
const mockWhere = vi.fn();

vi.mock('../../src/db/connection.js', () => {
  const createWhereChain = () => ({
    where: (...args: unknown[]) => {
      mockWhere(...args);
      return {
        executeTakeFirst: mockExecuteTakeFirst,
        where: (...innerArgs: unknown[]) => {
          mockWhere(...innerArgs);
          return { executeTakeFirst: mockExecuteTakeFirst };
        },
      };
    },
    executeTakeFirst: mockExecuteTakeFirst,
  });

  return {
    db: {
      selectFrom: vi.fn().mockReturnValue({
        selectAll: () => createWhereChain(),
      }),
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
});
