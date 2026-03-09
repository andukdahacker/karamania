import type { FastifyInstance } from 'fastify';
import { findByPartyCode, getParticipants } from '../persistence/session-repository.js';
import { generateGuestToken } from '../services/guest-token.js';
import { guestAuthRequestSchema, guestAuthResponseSchema } from '../shared/schemas/auth-schemas.js';
import { errorResponseSchema } from '../shared/schemas/common-schemas.js';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/auth/guest', {
    schema: {
      body: guestAuthRequestSchema,
      response: {
        200: guestAuthResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { partyCode } = request.body as { displayName: string; partyCode: string };

    const session = await findByPartyCode(partyCode);
    if (!session) {
      return reply.status(404).send({
        error: { code: 'NOT_FOUND', message: 'No active party with that code' },
      });
    }

    const participants = await getParticipants(session.id);
    if (participants.length >= 12) {
      return reply.status(403).send({
        error: { code: 'SESSION_FULL', message: 'This party is full. Maximum 12 participants.' },
      });
    }

    const guestId = crypto.randomUUID();
    const token = await generateGuestToken({ guestId, sessionId: session.id });

    return reply.send({
      data: {
        token,
        guestId,
        sessionId: session.id,
        vibe: session.vibe ?? 'general',
        status: session.status,
      },
    });
  });
}
