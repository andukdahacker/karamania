import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import Fastify from 'fastify';
import { validatorCompiler, serializerCompiler } from 'fastify-type-provider-zod';
import { errorHandler } from '../../src/shared/errors.js';
import { createTestUser } from '../factories/user.js';
import { createTestSession } from '../factories/session.js';

vi.mock('../../src/config.js', () => ({
  config: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_SECRET: 'test-secret-key-at-least-32-characters-long',
    YOUTUBE_API_KEY: 'test-youtube-key',
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

vi.mock('../../src/integrations/firebase-admin.js', () => ({
  verifyFirebaseToken: vi.fn(),
}));

vi.mock('../../src/persistence/user-repository.js', () => ({
  findByFirebaseUid: vi.fn(),
  findById: vi.fn(),
  upgradeGuestToAuthenticated: vi.fn(),
  upsertFromFirebase: vi.fn(),
}));

vi.mock('../../src/persistence/session-repository.js', () => ({
  findById: vi.fn(),
  getParticipants: vi.fn(),
  linkGuestParticipant: vi.fn(),
}));

vi.mock('../../src/persistence/media-repository.js', () => ({
  relinkCaptures: vi.fn(),
}));

import { verifyFirebaseToken } from '../../src/integrations/firebase-admin.js';
import {
  findByFirebaseUid,
  findById as findUserById,
  upgradeGuestToAuthenticated,
  upsertFromFirebase,
} from '../../src/persistence/user-repository.js';
import {
  findById as findSessionById,
  getParticipants,
  linkGuestParticipant,
} from '../../src/persistence/session-repository.js';
import { relinkCaptures } from '../../src/persistence/media-repository.js';

const mockVerifyFirebase = vi.mocked(verifyFirebaseToken);
const mockFindByFirebaseUid = vi.mocked(findByFirebaseUid);
const mockFindUserById = vi.mocked(findUserById);
const mockUpgradeGuest = vi.mocked(upgradeGuestToAuthenticated);
const mockUpsertFromFirebase = vi.mocked(upsertFromFirebase);
const mockFindSessionById = vi.mocked(findSessionById);
const mockGetParticipants = vi.mocked(getParticipants);
const mockLinkGuestParticipant = vi.mocked(linkGuestParticipant);
const mockRelinkCaptures = vi.mocked(relinkCaptures);

describe('GET /api/users/me', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.setErrorHandler(errorHandler);
    const { userRoutes } = await import('../../src/routes/users.js');
    await app.register(userRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  it('returns user profile with correct camelCase fields', async () => {
    const testUser = createTestUser({
      id: 'a0000000-0000-4000-a000-000000000001',
      display_name: 'Ducdo',
      avatar_url: 'https://example.com/avatar.png',
      created_at: new Date('2026-01-15T10:30:00Z'),
    });
    mockVerifyFirebase.mockResolvedValue({ uid: testUser.firebase_uid! } as never);
    mockFindByFirebaseUid.mockResolvedValue(testUser);

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data).toEqual({
      id: testUser.id,
      displayName: 'Ducdo',
      avatarUrl: 'https://example.com/avatar.png',
      createdAt: '2026-01-15T10:30:00.000Z',
    });
  });

  it('returns 401 when not authenticated', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe('AUTH_REQUIRED');
  });

  it('returns avatarUrl as null when user has no avatar', async () => {
    const testUser = createTestUser({
      id: 'a0000000-0000-4000-a000-000000000002',
      avatar_url: null,
    });
    mockVerifyFirebase.mockResolvedValue({ uid: testUser.firebase_uid! } as never);
    mockFindByFirebaseUid.mockResolvedValue(testUser);

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.avatarUrl).toBeNull();
  });

  it('returns createdAt as ISO 8601 string format', async () => {
    const testDate = new Date('2026-03-20T14:00:00Z');
    const testUser = createTestUser({
      id: 'a0000000-0000-4000-a000-000000000003',
      created_at: testDate,
    });
    mockVerifyFirebase.mockResolvedValue({ uid: testUser.firebase_uid! } as never);
    mockFindByFirebaseUid.mockResolvedValue(testUser);

    const response = await app.inject({
      method: 'GET',
      url: '/api/users/me',
      headers: { authorization: 'Bearer valid-token' },
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.createdAt).toBe('2026-03-20T14:00:00.000Z');
    // Verify it's parseable as ISO 8601
    expect(new Date(body.data.createdAt).toISOString()).toBe(body.data.createdAt);
  });
});

describe('POST /api/users/upgrade', () => {
  let app: ReturnType<typeof Fastify>;

  beforeEach(async () => {
    vi.clearAllMocks();
    app = Fastify();
    app.setValidatorCompiler(validatorCompiler);
    app.setSerializerCompiler(serializerCompiler);
    app.setErrorHandler(errorHandler);
    const { userRoutes } = await import('../../src/routes/users.js');
    await app.register(userRoutes);
    await app.ready();
  });

  afterEach(async () => {
    await app.close();
  });

  const validUpgradeBody = {
    firebaseToken: 'valid-firebase-token',
    guestId: 'a0000000-0000-4000-a000-000000000010',
    sessionId: '10000000-0000-4000-a000-000000000010',
    guestDisplayName: 'Guest Alice',
    captureIds: ['cap-1', 'cap-2'],
  };

  it('Path A: existing Firebase account — reuses account, links participant', async () => {
    const existingUser = createTestUser({
      id: 'a0000000-0000-4000-a000-000000000020',
      firebase_uid: 'fb-existing',
      display_name: 'Existing User',
    });
    const testSession = createTestSession({ id: validUpgradeBody.sessionId });

    mockVerifyFirebase.mockResolvedValue({ uid: 'fb-existing', name: 'Existing User' } as never);
    mockFindByFirebaseUid.mockResolvedValue(existingUser);
    mockFindSessionById.mockResolvedValue(testSession);
    mockGetParticipants.mockResolvedValue([
      { id: 'p1', user_id: null, guest_name: 'Guest Alice', display_name: null, joined_at: new Date() },
    ] as never);
    mockLinkGuestParticipant.mockResolvedValue(undefined);
    mockRelinkCaptures.mockResolvedValue(2);

    const response = await app.inject({
      method: 'POST',
      url: '/api/users/upgrade',
      payload: validUpgradeBody,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.userId).toBe(existingUser.id);
    expect(body.data.linkedParticipant).toBe(true);
    expect(body.data.linkedCaptureCount).toBe(2);
    // Verify linking used guestDisplayName, not Firebase displayName
    expect(mockLinkGuestParticipant).toHaveBeenCalledWith(
      validUpgradeBody.sessionId, 'Guest Alice', existingUser.id
    );
  });

  it('Path B: guest host with user record — upgrades firebase_uid, preserves user.id', async () => {
    const guestHost = { ...createTestUser({
      id: validUpgradeBody.guestId,
      display_name: 'Guest Host',
    }), firebase_uid: null as string | null };
    const upgradedHost = { ...guestHost, firebase_uid: 'fb-new', display_name: 'Google User' };
    const testSession = createTestSession({ id: validUpgradeBody.sessionId });

    mockVerifyFirebase.mockResolvedValue({ uid: 'fb-new', name: 'Google User' } as never);
    mockFindByFirebaseUid.mockResolvedValue(undefined);
    mockFindUserById.mockResolvedValue(guestHost);
    mockUpgradeGuest.mockResolvedValue(upgradedHost);
    mockFindSessionById.mockResolvedValue(testSession);
    mockGetParticipants.mockResolvedValue([]);
    mockRelinkCaptures.mockResolvedValue(0);

    const response = await app.inject({
      method: 'POST',
      url: '/api/users/upgrade',
      payload: validUpgradeBody,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.userId).toBe(validUpgradeBody.guestId);
    expect(mockUpgradeGuest).toHaveBeenCalledWith(
      validUpgradeBody.guestId, 'fb-new', 'Google User', undefined
    );
  });

  it('Path C: guest participant — creates new user, links participant + captures', async () => {
    const newUser = createTestUser({
      id: 'a0000000-0000-4000-a000-000000000030',
      firebase_uid: 'fb-new-participant',
      display_name: 'New Participant',
    });
    const testSession = createTestSession({ id: validUpgradeBody.sessionId });

    mockVerifyFirebase.mockResolvedValue({ uid: 'fb-new-participant', name: 'New Participant' } as never);
    mockFindByFirebaseUid.mockResolvedValue(undefined);
    mockFindUserById.mockResolvedValue(undefined);
    mockUpsertFromFirebase.mockResolvedValue(newUser);
    mockFindSessionById.mockResolvedValue(testSession);
    mockGetParticipants.mockResolvedValue([
      { id: 'p1', user_id: null, guest_name: 'Guest Alice', display_name: null, joined_at: new Date() },
    ] as never);
    mockLinkGuestParticipant.mockResolvedValue(undefined);
    mockRelinkCaptures.mockResolvedValue(2);

    const response = await app.inject({
      method: 'POST',
      url: '/api/users/upgrade',
      payload: validUpgradeBody,
    });

    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.data.userId).toBe(newUser.id);
    expect(body.data.linkedParticipant).toBe(true);
    expect(body.data.linkedCaptureCount).toBe(2);
    expect(mockUpsertFromFirebase).toHaveBeenCalledWith({
      firebaseUid: 'fb-new-participant',
      displayName: 'New Participant',
      avatarUrl: undefined,
    });
  });

  it('returns 401 for invalid Firebase token', async () => {
    mockVerifyFirebase.mockRejectedValue(new Error('Invalid token'));

    const response = await app.inject({
      method: 'POST',
      url: '/api/users/upgrade',
      payload: validUpgradeBody,
    });

    expect(response.statusCode).toBe(401);
    const body = response.json();
    expect(body.error.code).toBe('AUTH_INVALID');
  });

  it('idempotent: calling twice succeeds without error', async () => {
    const existingUser = createTestUser({
      id: 'a0000000-0000-4000-a000-000000000020',
      firebase_uid: 'fb-existing',
    });
    const testSession = createTestSession({ id: validUpgradeBody.sessionId });

    mockVerifyFirebase.mockResolvedValue({ uid: 'fb-existing', name: 'User' } as never);
    mockFindByFirebaseUid.mockResolvedValue(existingUser);
    mockFindSessionById.mockResolvedValue(testSession);
    mockGetParticipants.mockResolvedValue([]);
    mockRelinkCaptures.mockResolvedValue(0);

    const response1 = await app.inject({ method: 'POST', url: '/api/users/upgrade', payload: validUpgradeBody });
    const response2 = await app.inject({ method: 'POST', url: '/api/users/upgrade', payload: validUpgradeBody });

    expect(response1.statusCode).toBe(200);
    expect(response2.statusCode).toBe(200);
  });
});
