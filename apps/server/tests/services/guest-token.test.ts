import { describe, it, expect, vi, beforeEach } from 'vitest';
import { jwtVerify, SignJWT } from 'jose';

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

describe('guest-token service', () => {
  const secret = new TextEncoder().encode('test-secret-key-at-least-32-characters-long');

  beforeEach(() => {
    vi.clearAllMocks();
    vi.useRealTimers();
  });

  describe('generateGuestToken', () => {
    it('generates valid token with correct payload', async () => {
      const { generateGuestToken } = await import('../../src/services/guest-token.js');
      const token = await generateGuestToken({ guestId: 'guest-123', sessionId: 'session-456' });

      const { payload } = await jwtVerify(token, secret);
      expect(payload.sub).toBe('guest-123');
      expect(payload['sessionId']).toBe('session-456');
      expect(payload['role']).toBe('guest');
    });

    it('token verifies successfully with correct secret', async () => {
      const { generateGuestToken, verifyGuestToken } = await import('../../src/services/guest-token.js');
      const token = await generateGuestToken({ guestId: 'guest-123', sessionId: 'session-456' });

      const result = await verifyGuestToken(token);
      expect(result).toEqual({
        guestId: 'guest-123',
        sessionId: 'session-456',
        role: 'guest',
      });
    });

    it('token has 6-hour expiration', async () => {
      const { generateGuestToken } = await import('../../src/services/guest-token.js');
      const token = await generateGuestToken({ guestId: 'guest-123', sessionId: 'session-456' });

      const { payload } = await jwtVerify(token, secret);
      const issuedAt = payload.iat as number;
      const expiration = payload.exp as number;
      expect(expiration - issuedAt).toBe(6 * 60 * 60);
    });
  });

  describe('verifyGuestToken', () => {
    it('throws on expired token', async () => {
      const expiredToken = await new SignJWT({ sub: 'guest-123', sessionId: 'session-456', role: 'guest' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 7 * 60 * 60)
        .setExpirationTime(Math.floor(Date.now() / 1000) - 60 * 60)
        .sign(secret);

      const { verifyGuestToken } = await import('../../src/services/guest-token.js');
      await expect(verifyGuestToken(expiredToken)).rejects.toThrow('Invalid guest token');
    });

    it('throws on invalid signature (wrong secret)', async () => {
      const wrongSecret = new TextEncoder().encode('wrong-secret-key-at-least-32-characters-xx');
      const tokenWithWrongSecret = await new SignJWT({ sub: 'guest-123', sessionId: 'session-456', role: 'guest' })
        .setProtectedHeader({ alg: 'HS256' })
        .setIssuedAt()
        .setExpirationTime('6h')
        .sign(wrongSecret);

      const { verifyGuestToken } = await import('../../src/services/guest-token.js');
      await expect(verifyGuestToken(tokenWithWrongSecret)).rejects.toThrow('Invalid guest token');
    });
  });
});
