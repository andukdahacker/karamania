import { z } from 'zod/v4';
import type { FastifyInstance } from 'fastify';
import { findById } from '../persistence/session-repository.js';
import { findBySessionId as findMediaBySessionId } from '../persistence/media-repository.js';
import { generateDownloadUrl, StorageUnavailableError } from '../services/media-storage.js';
import { shareSessionResponseSchema } from '../shared/schemas/share-schemas.js';
import { errorResponseSchema } from '../shared/schemas/common-schemas.js';
import type { SessionSummary } from '../shared/schemas/finale-schemas.js';

export async function shareRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get<{ Params: { id: string } }>('/api/sessions/:id/share', {
    schema: {
      params: z.object({ id: z.string() }),
      response: {
        200: shareSessionResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const sessionId = request.params.id;

    const session = await findById(sessionId);
    if (!session) {
      return reply.status(404).send({
        error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
      });
    }

    if (session.status !== 'ended') {
      return reply.status(404).send({
        error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
      });
    }

    if (session.summary == null) {
      return reply.status(404).send({
        error: { code: 'SESSION_NOT_FOUND', message: 'Session not found' },
      });
    }

    const summary = JSON.parse(session.summary as string) as SessionSummary;

    // Fetch media captures and generate signed URLs
    const captures = await findMediaBySessionId(sessionId);
    const mediaUrls: string[] = [];
    await Promise.all(
      captures.map(async (capture) => {
        if (capture.storage_path) {
          try {
            const result = await generateDownloadUrl(capture.storage_path);
            mediaUrls.push(result.url);
          } catch (error: unknown) {
            if (error instanceof StorageUnavailableError) {
              // Filter out captures with unavailable URLs
              return;
            }
            throw error;
          }
        }
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
        },
        participants: summary.participants.map((p) => ({
          displayName: p.displayName,
          participationScore: p.participationScore,
          topAward: p.topAward,
        })),
        setlist: summary.setlist,
        mediaUrls,
      },
    });
  });
}
