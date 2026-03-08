import { describe, it, expect, vi, beforeEach } from 'vitest';
import { SignJWT } from 'jose';
import { EVENTS } from '../../src/shared/events.js';

vi.mock('../../src/config.js', () => ({
  config: {
    JWT_SECRET: 'test-secret-key-at-least-32-characters-long',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
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

const mockVerifyFirebaseToken = vi.fn();
vi.mock('../../src/integrations/firebase-admin.js', () => ({
  verifyFirebaseToken: mockVerifyFirebaseToken,
}));

const mockUpsertFromFirebase = vi.fn();
vi.mock('../../src/persistence/user-repository.js', () => ({
  upsertFromFirebase: mockUpsertFromFirebase,
}));

function createMockSocket(auth: Record<string, unknown> = {}): {
  handshake: { auth: Record<string, unknown> };
  data: Record<string, unknown>;
  emit: ReturnType<typeof vi.fn>;
  join: ReturnType<typeof vi.fn>;
} {
  return {
    handshake: { auth },
    data: {},
    emit: vi.fn(),
    join: vi.fn(),
  };
}

// Generate a proper RSA key pair for Firebase-style tokens
async function generateRsaKeyPair() {
  const keyPair = await crypto.subtle.generateKey(
    { name: 'RSASSA-PKCS1-v1_5', modulusLength: 2048, publicExponent: new Uint8Array([1, 0, 1]), hash: 'SHA-256' },
    true,
    ['sign', 'verify'],
  );
  return keyPair.privateKey;
}

async function createFirebaseStyleToken(rsaPrivateKey: CryptoKey) {
  return new SignJWT({ sub: 'firebase-uid-1' })
    .setProtectedHeader({ alg: 'RS256', kid: 'firebase-key-id' })
    .setIssuedAt()
    .setExpirationTime('1h')
    .sign(rsaPrivateKey);
}

describe('auth-middleware', () => {
  const secret = new TextEncoder().encode('test-secret-key-at-least-32-characters-long');
  let rsaPrivateKey: CryptoKey;

  beforeEach(async () => {
    vi.clearAllMocks();
    rsaPrivateKey = await generateRsaKeyPair();
  });

  it('calls next with AUTH_MISSING when no token provided', async () => {
    const { createAuthMiddleware } = await import('../../src/socket-handlers/auth-middleware.js');
    const middleware = createAuthMiddleware();
    const socket = createMockSocket();
    const next = vi.fn();

    await middleware(socket as never, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'AUTH_MISSING' }));
  });

  it('populates socket.data correctly for valid guest JWT', async () => {
    const token = await new SignJWT({ sub: 'guest-123', sessionId: 'session-456', role: 'guest' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('6h')
      .sign(secret);

    const { createAuthMiddleware } = await import('../../src/socket-handlers/auth-middleware.js');
    const middleware = createAuthMiddleware();
    const socket = createMockSocket({ token, sessionId: 'session-456', displayName: 'TestGuest' });
    const next = vi.fn();

    await middleware(socket as never, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data).toEqual({
      userId: 'guest-123',
      sessionId: 'session-456',
      role: 'guest',
      displayName: 'TestGuest',
    });
  });

  it('populates socket.data correctly for valid Firebase JWT', async () => {
    const firebaseToken = await createFirebaseStyleToken(rsaPrivateKey);

    mockVerifyFirebaseToken.mockResolvedValue({
      uid: 'firebase-uid-1',
      name: 'Firebase User',
      email: 'user@test.com',
      picture: 'https://example.com/avatar.jpg',
    });
    mockUpsertFromFirebase.mockResolvedValue({});

    const { createAuthMiddleware } = await import('../../src/socket-handlers/auth-middleware.js');
    const middleware = createAuthMiddleware();
    const socket = createMockSocket({ token: firebaseToken, sessionId: 'session-789' });
    const next = vi.fn();

    await middleware(socket as never, next);

    expect(next).toHaveBeenCalledWith();
    expect(socket.data).toEqual({
      userId: 'firebase-uid-1',
      sessionId: 'session-789',
      role: 'authenticated',
      displayName: 'Firebase User',
    });
  });

  it('calls next with AUTH_INVALID for invalid guest token', async () => {
    const wrongSecret = new TextEncoder().encode('wrong-secret-key-at-least-32-characters-xx');
    const invalidToken = await new SignJWT({ sub: 'guest-123', sessionId: 'session-456', role: 'guest' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('6h')
      .sign(wrongSecret);

    const { createAuthMiddleware } = await import('../../src/socket-handlers/auth-middleware.js');
    const middleware = createAuthMiddleware();
    const socket = createMockSocket({ token: invalidToken, sessionId: 'session-456' });
    const next = vi.fn();

    await middleware(socket as never, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'AUTH_INVALID' }));
  });

  it('emits AUTH_REFRESH_REQUIRED and calls next with AUTH_EXPIRED for expired Firebase token', async () => {
    const firebaseToken = await createFirebaseStyleToken(rsaPrivateKey);

    mockVerifyFirebaseToken.mockRejectedValue(new Error('Token expired'));

    const { createAuthMiddleware } = await import('../../src/socket-handlers/auth-middleware.js');
    const middleware = createAuthMiddleware();
    const socket = createMockSocket({ token: firebaseToken, sessionId: 'session-789' });
    const next = vi.fn();

    await middleware(socket as never, next);

    expect(socket.emit).toHaveBeenCalledWith(EVENTS.AUTH_REFRESH_REQUIRED);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'AUTH_EXPIRED' }));
  });

  it('produces identical socket.data shape for both auth paths', async () => {
    // Guest path
    const guestToken = await new SignJWT({ sub: 'guest-id', sessionId: 'session-1', role: 'guest' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('6h')
      .sign(secret);

    const { createAuthMiddleware } = await import('../../src/socket-handlers/auth-middleware.js');
    const middleware = createAuthMiddleware();
    const guestSocket = createMockSocket({ token: guestToken, sessionId: 'session-1', displayName: 'Guest' });
    const guestNext = vi.fn();
    await middleware(guestSocket as never, guestNext);

    // Firebase path
    const firebaseToken = await createFirebaseStyleToken(rsaPrivateKey);

    mockVerifyFirebaseToken.mockResolvedValue({
      uid: 'firebase-uid-1',
      name: 'Firebase User',
      email: 'user@test.com',
    });
    mockUpsertFromFirebase.mockResolvedValue({});

    const firebaseSocket = createMockSocket({ token: firebaseToken, sessionId: 'session-2' });
    const firebaseNext = vi.fn();
    await middleware(firebaseSocket as never, firebaseNext);

    // Both should have the same keys
    const guestKeys = Object.keys(guestSocket.data).sort();
    const firebaseKeys = Object.keys(firebaseSocket.data).sort();
    expect(guestKeys).toEqual(firebaseKeys);
    expect(guestKeys).toEqual(['displayName', 'role', 'sessionId', 'userId']);
  });

  it('joins socket to sessionId room after successful auth', async () => {
    const token = await new SignJWT({ sub: 'guest-123', sessionId: 'session-456', role: 'guest' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('6h')
      .sign(secret);

    const { createAuthMiddleware } = await import('../../src/socket-handlers/auth-middleware.js');
    const middleware = createAuthMiddleware();
    const socket = createMockSocket({ token, sessionId: 'session-456' });
    const next = vi.fn();

    await middleware(socket as never, next);

    expect(socket.join).toHaveBeenCalledWith('session-456');
  });

  it('calls next with SESSION_MISSING when sessionId is absent', async () => {
    const token = await new SignJWT({ sub: 'guest-123', sessionId: undefined as unknown as string, role: 'guest' })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime('6h')
      .sign(secret);

    const { createAuthMiddleware } = await import('../../src/socket-handlers/auth-middleware.js');
    const middleware = createAuthMiddleware();
    const socket = createMockSocket({ token });
    const next = vi.fn();

    await middleware(socket as never, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'SESSION_MISSING' }));
  });
});
