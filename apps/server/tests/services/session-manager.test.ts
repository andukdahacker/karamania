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
vi.mock('../../src/persistence/session-repository.js', () => ({
  create: mockSessionCreate,
  addParticipant: mockAddParticipant,
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
});
