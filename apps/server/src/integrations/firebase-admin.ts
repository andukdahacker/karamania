import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { getStorage } from 'firebase-admin/storage';
import { config } from '../config.js';

export type { DecodedIdToken };

export function initializeFirebaseAdmin(): void {
  if (getApps().length > 0) return;
  try {
    initializeApp({
      credential: cert({
        projectId: config.FIREBASE_PROJECT_ID,
        clientEmail: config.FIREBASE_CLIENT_EMAIL,
        privateKey: config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      }),
      storageBucket: config.FIREBASE_STORAGE_BUCKET,
    });
  } catch {
    if (config.NODE_ENV === 'development') {
      console.warn('Firebase Admin SDK initialization failed — Firebase auth disabled for local dev');
      return;
    }
    throw new Error('Firebase Admin SDK initialization failed');
  }
}

export function getStorageBucket(): ReturnType<ReturnType<typeof getStorage>['bucket']> {
  return getStorage().bucket();
}

export async function verifyFirebaseToken(idToken: string): Promise<DecodedIdToken> {
  return getAuth().verifyIdToken(idToken);
}
