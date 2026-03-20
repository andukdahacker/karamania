import type { FastifyInstance } from 'fastify';
import { requireAuth } from './middleware/rest-auth.js';
import { userProfileResponseSchema } from '../shared/schemas/user-schemas.js';
import { errorResponseSchema } from '../shared/schemas/common-schemas.js';

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
}
