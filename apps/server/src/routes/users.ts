import type { FastifyInstance } from 'fastify';
import { requireAuth } from './middleware/rest-auth.js';
import { userProfileResponseSchema } from '../shared/schemas/user-schemas.js';
import { errorResponseSchema } from '../shared/schemas/common-schemas.js';
import { verifyFirebaseToken } from '../integrations/firebase-admin.js';
import {
  findByFirebaseUid,
  findById,
  upgradeGuestToAuthenticated,
  upsertFromFirebase,
} from '../persistence/user-repository.js';
import {
  findById as findSessionById,
  getParticipants,
  linkGuestParticipant,
} from '../persistence/session-repository.js';
import { relinkCaptures } from '../persistence/media-repository.js';
import {
  upgradeRequestSchema,
  upgradeResponseSchema,
} from '../shared/schemas/upgrade-schemas.js';

export async function userRoutes(fastify: FastifyInstance): Promise<void> {
  // Decorate request so Fastify knows about the requestContext property
  fastify.decorateRequest('requestContext', undefined);

  fastify.get('/api/users/me', {
    preHandler: requireAuth,
    schema: {
      response: {
        200: userProfileResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const user = request.requestContext!.user;
    return reply.send({
      data: {
        id: user.id,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at.toISOString(),
      },
    });
  });

  // POST /api/users/upgrade — Guest-to-account upgrade
  fastify.post('/api/users/upgrade', {
    schema: {
      body: upgradeRequestSchema,
      response: {
        200: upgradeResponseSchema,
        400: errorResponseSchema,
        401: errorResponseSchema,
        409: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { firebaseToken, guestId, sessionId, guestDisplayName, captureIds } = request.body as {
      firebaseToken: string;
      guestId: string;
      sessionId: string;
      guestDisplayName: string;
      captureIds: string[];
    };

    // 1. Validate Firebase token
    let decoded;
    try {
      decoded = await verifyFirebaseToken(firebaseToken);
    } catch {
      return reply.status(401).send({
        error: { code: 'AUTH_INVALID', message: 'Invalid Firebase token' },
      });
    }

    const firebaseUid = decoded.uid;
    const displayName = (decoded.name ?? decoded.email ?? 'User') as string;
    const avatarUrl = decoded.picture as string | undefined;

    // 2. Check if Firebase account already exists
    const existingUser = await findByFirebaseUid(firebaseUid);

    let user;
    let linkedParticipant = false;

    if (existingUser) {
      // Case A: Firebase account exists — link current session data to existing account
      user = existingUser;
    } else {
      // Case B: No existing account — try to upgrade guest host's user record
      const guestUser = await findById(guestId);
      if (guestUser && guestUser.firebase_uid === null) {
        // Guest host: update existing record (preserves all FKs)
        user = await upgradeGuestToAuthenticated(guestId, firebaseUid, displayName, avatarUrl);
      } else {
        // Guest participant: create new user record
        user = await upsertFromFirebase({ firebaseUid, displayName, avatarUrl });
      }
    }

    // 3. Link guest participant record to user
    const session = await findSessionById(sessionId);
    if (session) {
      const participants = await getParticipants(sessionId);
      const guestParticipant = participants.find(
        (p) => p.user_id === null && p.guest_name !== null
          && p.guest_name === guestDisplayName
      );
      if (guestParticipant) {
        await linkGuestParticipant(sessionId, guestParticipant.guest_name!, user.id);
        linkedParticipant = true;
      }
    }

    // 4. Re-link media captures
    const linkedCaptureCount = await relinkCaptures(captureIds, user.id);

    return reply.send({
      data: {
        userId: user.id,
        displayName: user.display_name,
        avatarUrl: user.avatar_url,
        createdAt: user.created_at.toISOString(),
        linkedParticipant,
        linkedCaptureCount,
      },
    });
  });
}
