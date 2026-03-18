import { getStorageBucket } from '../integrations/firebase-admin.js';
import { config } from '../config.js';

const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;

const CONTENT_TYPE_MAP: Record<string, string> = {
  jpg: 'image/jpeg',
  mp4: 'video/mp4',
  m4a: 'audio/mp4',
};

export function getContentType(storagePath: string): string {
  const ext = storagePath.split('.').pop()?.toLowerCase() ?? '';
  return CONTENT_TYPE_MAP[ext] ?? 'application/octet-stream';
}

function ensureStorageConfigured(): void {
  if (!config.FIREBASE_STORAGE_BUCKET) {
    throw new StorageUnavailableError();
  }
}

export class StorageUnavailableError extends Error {
  readonly code = 'STORAGE_UNAVAILABLE';
  constructor() {
    super('Firebase Storage not configured');
    this.name = 'StorageUnavailableError';
  }
}

export async function generateUploadUrl(
  storagePath: string,
  contentType: string
): Promise<string> {
  ensureStorageConfigured();
  const [url] = await getStorageBucket()
    .file(storagePath)
    .getSignedUrl({
      version: 'v4',
      action: 'write',
      expires: Date.now() + 15 * 60 * 1000,
      contentType,
    });
  return url;
}

export async function generateDownloadUrl(
  storagePath: string
): Promise<{ url: string; expiresAt: Date }> {
  ensureStorageConfigured();
  const expiresAt = new Date(Date.now() + SEVEN_DAYS_MS);
  const [url] = await getStorageBucket()
    .file(storagePath)
    .getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: expiresAt,
    });
  return { url, expiresAt };
}

export async function deleteFile(storagePath: string): Promise<void> {
  ensureStorageConfigured();
  try {
    await getStorageBucket().file(storagePath).delete();
  } catch (error: unknown) {
    const code = (error as { code?: number }).code;
    if (code === 404) return;
    throw error;
  }
}

export async function fileExists(storagePath: string): Promise<boolean> {
  ensureStorageConfigured();
  const [exists] = await getStorageBucket().file(storagePath).exists();
  return exists;
}
