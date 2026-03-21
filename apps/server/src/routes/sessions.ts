import { z } from 'zod/v4';
import type { FastifyInstance } from 'fastify';
import { verifyFirebaseToken } from '../integrations/firebase-admin.js';
import { upsertFromFirebase } from '../persistence/user-repository.js';
import { createGuestUser } from '../persistence/user-repository.js';
import { createSession } from '../services/session-manager.js';
import { generateGuestToken } from '../services/guest-token.js';
import { findUserSessions, countUserSessions, findSessionDetail } from '../persistence/session-repository.js';
import { findBySessionId as findMediaBySessionId } from '../persistence/media-repository.js';
import { generateDownloadUrl, StorageUnavailableError } from '../services/media-storage.js';
import { createSessionRequestSchema, createSessionResponseSchema } from '../shared/schemas/session-schemas.js';
import {
  sessionTimelineQuerySchema,
  sessionTimelineResponseSchema,
  sessionDetailResponseSchema,
} from '../shared/schemas/timeline-schemas.js';
import { errorResponseSchema } from '../shared/schemas/common-schemas.js';
import { requireAuth } from './middleware/rest-auth.js';
import type { SessionSummary } from '../shared/schemas/finale-schemas.js';

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

  fastify.get<{ Params: { id: string } }>('/api/sessions/:id', {
    preHandler: requireAuth,
    schema: {
      params: z.object({ id: z.string() }),
      response: {
        200: sessionDetailResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = request.requestContext!.userId;
    const sessionId = request.params.id;

    const session = await findSessionDetail(sessionId, userId);
    if (!session) {
      return reply.status(403).send({
        error: { code: 'SESSION_ACCESS_DENIED', message: 'Session not found or access denied' },
      });
    }

    const summary = JSON.parse(session.summary as string) as SessionSummary;

    // Fetch media captures and generate signed URLs
    const captures = await findMediaBySessionId(sessionId);
    const media = await Promise.all(
      captures.map(async (capture) => {
        let url: string | null = null;
        if (capture.storage_path) {
          try {
            const result = await generateDownloadUrl(capture.storage_path);
            url = result.url;
          } catch (error: unknown) {
            if (error instanceof StorageUnavailableError) {
              url = null;
            } else {
              throw error;
            }
          }
        }
        return {
          id: capture.id,
          url,
          triggerType: capture.trigger_type,
          createdAt: capture.created_at.toISOString(),
        };
      }),
    );

    const sessionDurationMs = session.ended_at && session.created_at
      ? new Date(session.ended_at).getTime() - new Date(session.created_at).getTime()
      : summary.stats.sessionDurationMs;

    return reply.send({
      data: {
        id: session.id,
        venueName: session.venue_name,
        vibe: session.vibe,
        createdAt: session.created_at.toISOString(),
        endedAt: session.ended_at?.toISOString() ?? null,
        stats: {
          songCount: summary.stats.songCount,
          participantCount: summary.stats.participantCount,
          sessionDurationMs,
          totalReactions: summary.stats.totalReactions,
          totalSoundboardPlays: summary.stats.totalSoundboardPlays,
          totalCardsDealt: summary.stats.totalCardsDealt,
        },
        participants: summary.participants,
        setlist: summary.setlist,
        awards: summary.awards,
        media,
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
