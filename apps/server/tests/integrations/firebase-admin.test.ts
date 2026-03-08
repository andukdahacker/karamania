import { describe, it, expect, vi, beforeEach } from 'vitest';

const mockInitializeApp = vi.fn();
const mockCert = vi.fn().mockReturnValue('mock-credential');
const mockGetApps = vi.fn();
const mockVerifyIdToken = vi.fn();
const mockGetAuth = vi.fn().mockReturnValue({ verifyIdToken: mockVerifyIdToken });

vi.mock('firebase-admin/app', () => ({
  initializeApp: mockInitializeApp,
  cert: mockCert,
  getApps: mockGetApps,
}));

vi.mock('firebase-admin/auth', () => ({
  getAuth: mockGetAuth,
}));

vi.mock('../../src/config.js', () => ({
  config: {
    FIREBASE_PROJECT_ID: 'test-project',
    FIREBASE_CLIENT_EMAIL: 'test@test.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: 'test-key\\nwith-newlines',
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_SECRET: 'test-secret-key-at-least-32-characters-long',
    YOUTUBE_API_KEY: 'test-key',
    SPOTIFY_CLIENT_ID: 'test-id',
    SPOTIFY_CLIENT_SECRET: 'test-secret',
    NODE_ENV: 'test',
    PORT: 3000,
  },
}));

describe('firebase-admin integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('initializeFirebaseAdmin', () => {
    it('calls initializeApp with correct cert when no apps exist', async () => {
      mockGetApps.mockReturnValue([]);

      const { initializeFirebaseAdmin } = await import('../../src/integrations/firebase-admin.js');
      initializeFirebaseAdmin();

      expect(mockCert).toHaveBeenCalledWith({
        projectId: 'test-project',
        clientEmail: 'test@test.iam.gserviceaccount.com',
        privateKey: 'test-key\nwith-newlines',
      });
      expect(mockInitializeApp).toHaveBeenCalledWith({
        credential: 'mock-credential',
      });
    });

    it('skips initialization if already initialized', async () => {
      mockGetApps.mockReturnValue([{ name: 'existing-app' }]);

      const { initializeFirebaseAdmin } = await import('../../src/integrations/firebase-admin.js');
      initializeFirebaseAdmin();

      expect(mockInitializeApp).not.toHaveBeenCalled();
    });
  });

  describe('verifyFirebaseToken', () => {
    it('returns decoded token on success', async () => {
      mockGetApps.mockReturnValue([]);
      const mockDecodedToken = { uid: 'user-123', name: 'Test User', email: 'test@test.com' };
      mockVerifyIdToken.mockResolvedValue(mockDecodedToken);

      const { verifyFirebaseToken } = await import('../../src/integrations/firebase-admin.js');
      const result = await verifyFirebaseToken('valid-token');

      expect(mockGetAuth).toHaveBeenCalled();
      expect(mockVerifyIdToken).toHaveBeenCalledWith('valid-token');
      expect(result).toEqual(mockDecodedToken);
    });

    it('throws on invalid token', async () => {
      mockGetApps.mockReturnValue([]);
      mockVerifyIdToken.mockRejectedValue(new Error('Decoding Firebase ID token failed'));

      const { verifyFirebaseToken } = await import('../../src/integrations/firebase-admin.js');
      await expect(verifyFirebaseToken('invalid-token')).rejects.toThrow('Decoding Firebase ID token failed');
    });
  });
});
