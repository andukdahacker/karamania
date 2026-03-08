import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth, type DecodedIdToken } from 'firebase-admin/auth';
import { config } from '../config.js';

export type { DecodedIdToken };

export function initializeFirebaseAdmin(): void {
  if (getApps().length > 0) return;
  initializeApp({
    credential: cert({
      projectId: config.FIREBASE_PROJECT_ID,
      clientEmail: config.FIREBASE_CLIENT_EMAIL,
      privateKey: config.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

export async function verifyFirebaseToken(idToken: string): Promise<DecodedIdToken> {
  return getAuth().verifyIdToken(idToken);
}
