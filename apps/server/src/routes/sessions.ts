import type { FastifyInstance } from 'fastify';
import { verifyFirebaseToken } from '../integrations/firebase-admin.js';
import { upsertFromFirebase } from '../persistence/user-repository.js';
import { createGuestUser } from '../persistence/user-repository.js';
import { createSession } from '../services/session-manager.js';
import { generateGuestToken } from '../services/guest-token.js';
import { createSessionRequestSchema, createSessionResponseSchema } from '../shared/schemas/session-schemas.js';
import { errorResponseSchema } from '../shared/schemas/common-schemas.js';

export async function sessionRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/sessions', {
    schema: {
      body: createSessionRequestSchema,
      response: {
        201: createSessionResponseSchema,
        400: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const body = request.body as { displayName?: string; vibe?: string; venueName?: string };
    const authHeader = request.headers.authorization;

    let hostUserId: string;
    let displayName: string;

    if (authHeader) {
      // Firebase path
      const token = authHeader.slice(7);
      const decoded = await verifyFirebaseToken(token);
      const user = await upsertFromFirebase({
        firebaseUid: decoded.uid,
        displayName: (decoded.name ?? decoded.email ?? 'User') as string,
        avatarUrl: decoded.picture as string | undefined,
      });
      hostUserId = user.id;
      displayName = user.display_name;

      const result = await createSession({
        hostUserId,
        displayName,
        vibe: body.vibe,
        venueName: body.venueName,
      });

      return reply.status(201).send({
        data: {
          sessionId: result.sessionId,
          partyCode: result.partyCode,
        },
      });
    } else {
      // Guest path
      if (!body.displayName) {
        return reply.status(400).send({
          error: { code: 'BAD_REQUEST', message: 'displayName is required for guest hosts' },
        });
      }

      const user = await createGuestUser(body.displayName);
      hostUserId = user.id;
      displayName = user.display_name;

      const result = await createSession({
        hostUserId,
        displayName,
        vibe: body.vibe,
        venueName: body.venueName,
      });

      const guestToken = await generateGuestToken({
        guestId: hostUserId,
        sessionId: result.sessionId,
      });

      return reply.status(201).send({
        data: {
          sessionId: result.sessionId,
          partyCode: result.partyCode,
          token: guestToken,
          guestId: hostUserId,
        },
      });
    }
  });
}
