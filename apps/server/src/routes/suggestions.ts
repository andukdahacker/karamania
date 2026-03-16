import type { FastifyInstance } from 'fastify';
import { z } from 'zod/v4';
import * as sessionRepo from '../persistence/session-repository.js';
import { computeSuggestions } from '../services/suggestion-engine.js';
import { suggestionsQuerySchema, suggestionsResponseSchema } from '../shared/schemas/suggestion-schemas.js';
import { errorResponseSchema } from '../shared/schemas/common-schemas.js';
import { verifyFirebaseToken } from '../integrations/firebase-admin.js';
import { verifyGuestToken } from '../services/guest-token.js';

export async function suggestionRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/sessions/:sessionId/suggestions', {
    schema: {
      params: z.object({ sessionId: z.string().uuid() }),
      querystring: suggestionsQuerySchema,
      response: {
        200: suggestionsResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const { count } = request.query as { count: number };

    // Auth required — inline extraction (same pattern as playlists route)
    const authHeader = request.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
      return reply.status(401).send({ error: { code: 'AUTH_REQUIRED', message: 'Authorization required' } });
    }
    const token = authHeader.slice(7);
    let userId: string;
    try {
      const decoded = await verifyFirebaseToken(token);
      userId = decoded.uid;
    } catch {
      try {
        const guest = await verifyGuestToken(token);
        userId = guest.guestId;
      } catch {
        return reply.status(401).send({ error: { code: 'AUTH_INVALID', message: 'Invalid token' } });
      }
    }

    // Verify session exists and is active or lobby (lobby allowed for pre-game browsing)
    const session = await sessionRepo.findById(sessionId);
    if (!session || (session.status !== 'lobby' && session.status !== 'active')) {
      return reply.status(404).send({ error: { code: 'SESSION_NOT_FOUND', message: 'Session not found or ended' } });
    }

    // Verify requester is a participant
    const participants = await sessionRepo.getParticipants(sessionId);
    const isParticipant = participants.some(p => (p.user_id ?? p.id) === userId);
    if (!isParticipant) {
      return reply.status(403).send({ error: { code: 'NOT_PARTICIPANT', message: 'You are not a participant of this session' } });
    }

    const suggestions = await computeSuggestions(sessionId, count);

    return reply.send({ data: { suggestions } });
  });
}
