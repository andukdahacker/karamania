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

const mockFindByPartyCode = vi.fn();
vi.mock('../../src/persistence/session-repository.js', () => ({
  findByPartyCode: mockFindByPartyCode,
}));

const VALID_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';

describe('generatePartyCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a 4-character string by default', async () => {
    const { generatePartyCode } = await import('../../src/services/party-code.js');
    const code = generatePartyCode();
    expect(code).toHaveLength(4);
  });

  it('only contains valid characters (no 0, O, 1, I, L)', async () => {
    const { generatePartyCode } = await import('../../src/services/party-code.js');
    for (let i = 0; i < 100; i++) {
      const code = generatePartyCode();
      for (const char of code) {
        expect(VALID_CHARS).toContain(char);
      }
    }
  });

  it('returns a 6-character string when length=6', async () => {
    const { generatePartyCode } = await import('../../src/services/party-code.js');
    const code = generatePartyCode(6);
    expect(code).toHaveLength(6);
  });
});

describe('generateUniquePartyCode', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns a code when no collision', async () => {
    mockFindByPartyCode.mockResolvedValue(undefined);
    const { generateUniquePartyCode } = await import('../../src/services/party-code.js');
    const code = await generateUniquePartyCode();
    expect(code).toHaveLength(4);
    expect(mockFindByPartyCode).toHaveBeenCalledTimes(1);
  });

  it('retries on collision then succeeds', async () => {
    const { createTestSession } = await import('../factories/session.js');
    mockFindByPartyCode
      .mockResolvedValueOnce(createTestSession({ party_code: 'AAAA' }))
      .mockResolvedValueOnce(createTestSession({ party_code: 'BBBB' }))
      .mockResolvedValueOnce(undefined);
    const { generateUniquePartyCode } = await import('../../src/services/party-code.js');
    const code = await generateUniquePartyCode();
    expect(code).toHaveLength(4);
    expect(mockFindByPartyCode).toHaveBeenCalledTimes(3);
  });

  it('throws after 10 failed attempts', async () => {
    const { createTestSession } = await import('../factories/session.js');
    mockFindByPartyCode.mockResolvedValue(createTestSession({ party_code: 'AAAA' }));
    const { generateUniquePartyCode } = await import('../../src/services/party-code.js');
    await expect(generateUniquePartyCode()).rejects.toThrow('Failed to generate unique party code');
    expect(mockFindByPartyCode).toHaveBeenCalledTimes(10);
  });
});
