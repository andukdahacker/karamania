import type { FastifyInstance } from 'fastify';
import { verifyFirebaseToken } from '../integrations/firebase-admin.js';
import { upsertFromFirebase } from '../persistence/user-repository.js';
import { createGuestUser } from '../persistence/user-repository.js';
import { createSession } from '../services/session-manager.js';
import { generateGuestToken } from '../services/guest-token.js';
import { findUserSessions, countUserSessions } from '../persistence/session-repository.js';
import { generateDownloadUrl, StorageUnavailableError } from '../services/media-storage.js';
import { createSessionRequestSchema, createSessionResponseSchema } from '../shared/schemas/session-schemas.js';
import {
  sessionTimelineQuerySchema,
  sessionTimelineResponseSchema,
} from '../shared/schemas/timeline-schemas.js';
import { errorResponseSchema } from '../shared/schemas/common-schemas.js';
import { requireAuth } from './middleware/rest-auth.js';

export async function sessionRoutes(fastify: FastifyInstance): Promise<void> {
  // Decorate request so Fastify knows about the requestContext property
  fastify.decorateRequest('requestContext', undefined);

  fastify.get('/api/sessions', {
    preHandler: requireAuth,
    schema: {
      querystring: sessionTimelineQuerySchema,
      response: {
        200: sessionTimelineResponseSchema,
        401: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = request.requestContext!.userId;
    const { limit, offset } = request.query as { limit: number; offset: number };

    const [sessions, total] = await Promise.all([
      findUserSessions(userId, limit, offset),
      countUserSessions(userId),
    ]);

    const sessionsWithUrls = await Promise.all(
      sessions.map(async (session) => {
        let thumbnailUrl: string | null = null;
        if (session.thumbnail_storage_path) {
          try {
            const result = await generateDownloadUrl(session.thumbnail_storage_path);
            thumbnailUrl = result.url;
          } catch (error: unknown) {
            if (error instanceof StorageUnavailableError) {
              thumbnailUrl = null;
            } else {
              throw error;
            }
          }
        }
        return {
          id: session.id,
          venueName: session.venue_name,
          endedAt: session.ended_at?.toISOString() ?? null,
          participantCount: session.participant_count,
          topAward: session.top_award,
          thumbnailUrl,
        };
      }),
    );

    return reply.send({
      data: {
        sessions: sessionsWithUrls,
        total,
        offset,
        limit,
      },
    });
  });

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
