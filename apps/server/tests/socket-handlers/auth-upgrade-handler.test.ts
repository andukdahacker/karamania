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

vi.mock('../../src/db/connection.js', () => ({
  db: {},
}));

const mockVerifyFirebaseToken = vi.fn();
vi.mock('../../src/integrations/firebase-admin.js', () => ({
  verifyFirebaseToken: (...args: unknown[]) => mockVerifyFirebaseToken(...args),
}));

const mockFindByFirebaseUid = vi.fn();
vi.mock('../../src/persistence/user-repository.js', () => ({
  findByFirebaseUid: (...args: unknown[]) => mockFindByFirebaseUid(...args),
}));

function createMockSocket() {
  const handlers = new Map<string, (data: unknown) => Promise<void>>();

  return {
    socket: {
      data: {
        userId: 'guest-uuid-123',
        sessionId: 'session-1',
        role: 'guest' as string,
        displayName: 'Guest User',
      },
      on: (event: string, handler: (data: unknown) => Promise<void>) => {
        handlers.set(event, handler);
      },
    },
    handlers,
  };
}

describe('auth-upgrade-handler', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('valid Firebase token → updates socket.data.role to authenticated and userId to user.id', async () => {
    const user = createTestUser({
      id: 'a0000000-0000-4000-a000-000000000001',
      firebase_uid: 'fb-123',
      display_name: 'Authenticated User',
    });
    mockVerifyFirebaseToken.mockResolvedValue({ uid: 'fb-123' });
    mockFindByFirebaseUid.mockResolvedValue(user);

    const { socket, handlers } = createMockSocket();
    const { registerAuthUpgradeHandler } = await import('../../src/socket-handlers/auth-upgrade-handler.js');
    registerAuthUpgradeHandler(socket as never);

    const handler = handlers.get('auth:upgraded');
    expect(handler).toBeDefined();
    await handler!({ firebaseToken: 'valid-token' });

    expect(socket.data.userId).toBe(user.id);
    expect(socket.data.role).toBe('authenticated');
    expect(socket.data.displayName).toBe('Authenticated User');
  });

  it('invalid token → socket.data unchanged (silent failure)', async () => {
    mockVerifyFirebaseToken.mockRejectedValue(new Error('Invalid token'));

    const { socket, handlers } = createMockSocket();
    const { registerAuthUpgradeHandler } = await import('../../src/socket-handlers/auth-upgrade-handler.js');
    registerAuthUpgradeHandler(socket as never);

    const handler = handlers.get('auth:upgraded');
    await handler!({ firebaseToken: 'bad-token' });

    expect(socket.data.userId).toBe('guest-uuid-123');
    expect(socket.data.role).toBe('guest');
    expect(socket.data.displayName).toBe('Guest User');
  });

  it('user not found → socket.data unchanged (silent failure)', async () => {
    mockVerifyFirebaseToken.mockResolvedValue({ uid: 'fb-unknown' });
    mockFindByFirebaseUid.mockResolvedValue(undefined);

    const { socket, handlers } = createMockSocket();
    const { registerAuthUpgradeHandler } = await import('../../src/socket-handlers/auth-upgrade-handler.js');
    registerAuthUpgradeHandler(socket as never);

    const handler = handlers.get('auth:upgraded');
    await handler!({ firebaseToken: 'valid-token' });

    expect(socket.data.userId).toBe('guest-uuid-123');
    expect(socket.data.role).toBe('guest');
  });

  it('updates displayName from user record', async () => {
    const user = createTestUser({
      id: 'a0000000-0000-4000-a000-000000000002',
      display_name: 'DB Display Name',
    });
    mockVerifyFirebaseToken.mockResolvedValue({ uid: user.firebase_uid });
    mockFindByFirebaseUid.mockResolvedValue(user);

    const { socket, handlers } = createMockSocket();
    const { registerAuthUpgradeHandler } = await import('../../src/socket-handlers/auth-upgrade-handler.js');
    registerAuthUpgradeHandler(socket as never);

    const handler = handlers.get('auth:upgraded');
    await handler!({ firebaseToken: 'valid-token' });

    expect(socket.data.displayName).toBe('DB Display Name');
  });
});
