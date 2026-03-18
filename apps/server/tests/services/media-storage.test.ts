import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../src/config.js', () => ({
  config: {
    FIREBASE_STORAGE_BUCKET: 'test-bucket.firebasestorage.app',
    NODE_ENV: 'test',
  },
}));

const mockGetSignedUrl = vi.fn();
const mockDelete = vi.fn();
const mockExists = vi.fn();

const mockFile = vi.fn(() => ({
  getSignedUrl: mockGetSignedUrl,
  delete: mockDelete,
  exists: mockExists,
}));

const mockBucket = vi.fn(() => ({
  file: mockFile,
}));

vi.mock('../../src/integrations/firebase-admin.js', () => ({
  getStorageBucket: () => mockBucket(),
}));

describe('media-storage', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('generateUploadUrl', () => {
    it('returns signed upload URL', async () => {
      mockGetSignedUrl.mockResolvedValue(['https://storage.googleapis.com/upload-url']);

      const { generateUploadUrl } = await import('../../src/services/media-storage.js');
      const url = await generateUploadUrl('session-1/capture-1.jpg', 'image/jpeg');

      expect(url).toBe('https://storage.googleapis.com/upload-url');
      expect(mockFile).toHaveBeenCalledWith('session-1/capture-1.jpg');
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 'v4',
          action: 'write',
          contentType: 'image/jpeg',
        }),
      );
    });

    it('throws on storage failure', async () => {
      mockGetSignedUrl.mockRejectedValue(new Error('Storage error'));

      const { generateUploadUrl } = await import('../../src/services/media-storage.js');
      await expect(generateUploadUrl('path.jpg', 'image/jpeg')).rejects.toThrow('Storage error');
    });
  });

  describe('generateDownloadUrl', () => {
    it('returns signed download URL with expiry', async () => {
      mockGetSignedUrl.mockResolvedValue(['https://storage.googleapis.com/download-url']);

      const { generateDownloadUrl } = await import('../../src/services/media-storage.js');
      const result = await generateDownloadUrl('session-1/capture-1.jpg');

      expect(result.url).toBe('https://storage.googleapis.com/download-url');
      expect(result.expiresAt).toBeInstanceOf(Date);
      expect(mockGetSignedUrl).toHaveBeenCalledWith(
        expect.objectContaining({
          version: 'v4',
          action: 'read',
        }),
      );
    });
  });

  describe('deleteFile', () => {
    it('deletes file from storage', async () => {
      mockDelete.mockResolvedValue(undefined);

      const { deleteFile } = await import('../../src/services/media-storage.js');
      await deleteFile('session-1/capture-1.jpg');

      expect(mockFile).toHaveBeenCalledWith('session-1/capture-1.jpg');
      expect(mockDelete).toHaveBeenCalled();
    });

    it('swallows 404 errors', async () => {
      mockDelete.mockRejectedValue({ code: 404 });

      const { deleteFile } = await import('../../src/services/media-storage.js');
      await expect(deleteFile('nonexistent.jpg')).resolves.toBeUndefined();
    });

    it('rethrows non-404 errors', async () => {
      mockDelete.mockRejectedValue(new Error('Permission denied'));

      const { deleteFile } = await import('../../src/services/media-storage.js');
      await expect(deleteFile('path.jpg')).rejects.toThrow('Permission denied');
    });
  });

  describe('fileExists', () => {
    it('returns true when file exists', async () => {
      mockExists.mockResolvedValue([true]);

      const { fileExists } = await import('../../src/services/media-storage.js');
      const result = await fileExists('session-1/capture-1.jpg');

      expect(result).toBe(true);
    });

    it('returns false when file does not exist', async () => {
      mockExists.mockResolvedValue([false]);

      const { fileExists } = await import('../../src/services/media-storage.js');
      const result = await fileExists('nonexistent.jpg');

      expect(result).toBe(false);
    });
  });

  describe('getContentType', () => {
    it('returns correct content type for known extensions', async () => {
      const { getContentType } = await import('../../src/services/media-storage.js');
      expect(getContentType('file.jpg')).toBe('image/jpeg');
      expect(getContentType('file.mp4')).toBe('video/mp4');
      expect(getContentType('file.m4a')).toBe('audio/mp4');
    });

    it('returns octet-stream for unknown extensions', async () => {
      const { getContentType } = await import('../../src/services/media-storage.js');
      expect(getContentType('file.xyz')).toBe('application/octet-stream');
    });
  });

  describe('StorageUnavailableError', () => {
    it('is thrown when bucket is not configured', async () => {
      // Temporarily clear the bucket config
      const { config } = await import('../../src/config.js');
      const original = config.FIREBASE_STORAGE_BUCKET;
      (config as Record<string, unknown>).FIREBASE_STORAGE_BUCKET = undefined;

      const { generateUploadUrl, StorageUnavailableError } = await import('../../src/services/media-storage.js');

      await expect(generateUploadUrl('path.jpg', 'image/jpeg')).rejects.toBeInstanceOf(StorageUnavailableError);

      // Restore
      (config as Record<string, unknown>).FIREBASE_STORAGE_BUCKET = original;
    });
  });
});
