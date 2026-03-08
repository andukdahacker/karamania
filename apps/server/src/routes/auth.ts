import type { FastifyInstance } from 'fastify';
import { findByPartyCode } from '../persistence/session-repository.js';
import { generateGuestToken } from '../services/guest-token.js';
import { notFoundError } from '../shared/errors.js';
import { guestAuthRequestSchema } from '../shared/schemas/auth-schemas.js';

export async function authRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/auth/guest', {
    schema: {
      body: guestAuthRequestSchema,
    },
  }, async (request, reply) => {
    const { partyCode } = request.body as { displayName: string; partyCode: string };

    const session = await findByPartyCode(partyCode);
    if (!session) {
      const error = notFoundError('No active party with that code');
      return reply.status(error.statusCode!).send({
        error: { code: error.code, message: error.message },
      });
    }

    const guestId = crypto.randomUUID();
    const token = await generateGuestToken({ guestId, sessionId: session.id });

    return reply.send({ data: { token, guestId } });
  });
}
