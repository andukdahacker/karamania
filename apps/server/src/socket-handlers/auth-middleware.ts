import type { Socket } from 'socket.io';
import type { FastifyBaseLogger } from 'fastify';
import { decodeProtectedHeader } from 'jose';
import { verifyFirebaseToken } from '../integrations/firebase-admin.js';
import { verifyGuestToken } from '../services/guest-token.js';
import { upsertFromFirebase } from '../persistence/user-repository.js';
import { EVENTS } from '../shared/events.js';

export function createAuthMiddleware(logger?: FastifyBaseLogger): (socket: Socket, next: (err?: Error) => void) => void {
  return async (socket: Socket, next: (err?: Error) => void) => {
    const token = socket.handshake.auth['token'] as string | undefined;
    if (!token) {
      logger?.warn('Socket auth failed: no token');
      next(new Error('AUTH_MISSING'));
      return;
    }

    try {
      const header = await decodeProtectedHeader(token);

      if (header.kid) {
        // Firebase path (RS256 with key ID)
        try {
          const decodedToken = await verifyFirebaseToken(token);
          socket.data = {
            userId: decodedToken.uid,
            sessionId: socket.handshake.auth['sessionId'] as string,
            role: 'authenticated',
            displayName: (decodedToken.name ?? decodedToken.email ?? 'User') as string,
          };

          // Fire-and-forget user persistence
          upsertFromFirebase({
            firebaseUid: decodedToken.uid,
            displayName: socket.data.displayName,
            avatarUrl: decodedToken.picture as string | undefined,
          }).catch(() => {
            // Silently ignore persistence errors — don't block handshake
          });
        } catch {
          logger?.warn('Socket auth failed: Firebase token expired or invalid');
          socket.emit(EVENTS.AUTH_REFRESH_REQUIRED);
          next(new Error('AUTH_EXPIRED'));
          return;
        }
      } else if (header.alg === 'HS256') {
        // Guest path
        try {
          const payload = await verifyGuestToken(token);
          socket.data = {
            userId: payload.guestId,
            sessionId: payload.sessionId,
            role: 'guest',
            displayName: (socket.handshake.auth['displayName'] as string) ?? 'Guest',
          };
        } catch {
          logger?.warn('Socket auth failed: invalid guest token');
          next(new Error('AUTH_INVALID'));
          return;
        }
      } else {
        logger?.warn({ alg: header.alg }, 'Socket auth failed: unsupported token type');
        next(new Error('AUTH_INVALID'));
        return;
      }
    } catch {
      logger?.warn('Socket auth failed: could not decode token header');
      next(new Error('AUTH_INVALID'));
      return;
    }

    // Validate sessionId
    if (!socket.data.sessionId) {
      logger?.warn('Socket auth failed: no sessionId');
      next(new Error('SESSION_MISSING'));
      return;
    }

    // Join socket to session room for cross-session isolation (NFR24)
    socket.join(socket.data.sessionId);

    next();
  };
}
