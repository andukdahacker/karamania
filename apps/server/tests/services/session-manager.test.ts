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
vi.mock('../../src/persistence/session-repository.js', () => ({
  create: mockSessionCreate,
  addParticipant: mockAddParticipant,
  addParticipantIfNotExists: mockAddParticipantIfNotExists,
  getParticipants: mockGetParticipants,
  findById: mockFindById,
  updateStatus: mockUpdateStatus,
  updateHost: mockUpdateHost,
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
      expect(result).toEqual({ status: 'active' });
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
});
