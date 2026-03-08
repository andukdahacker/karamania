import { SignJWT, jwtVerify } from 'jose';
import { config } from '../config.js';
import { unauthorizedError } from '../shared/errors.js';

export interface GuestTokenPayload {
  guestId: string;
  sessionId: string;
  role: 'guest';
}

const secret = new TextEncoder().encode(config.JWT_SECRET);

export async function generateGuestToken({ guestId, sessionId }: { guestId: string; sessionId: string }): Promise<string> {
  return new SignJWT({ sub: guestId, sessionId, role: 'guest' })
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime('6h')
    .sign(secret);
}

export async function verifyGuestToken(token: string): Promise<GuestTokenPayload> {
  try {
    const { payload } = await jwtVerify(token, secret);
    return {
      guestId: payload.sub as string,
      sessionId: payload['sessionId'] as string,
      role: 'guest',
    };
  } catch {
    throw unauthorizedError('Invalid guest token');
  }
}
