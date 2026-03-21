import type { FastifyInstance } from 'fastify';
import { requireAuth } from './middleware/rest-auth.js';
import { findAllByUserId } from '../persistence/media-repository.js';
import { generateDownloadUrl, StorageUnavailableError } from '../services/media-storage.js';
import { mediaGalleryResponseSchema, mediaGalleryQuerySchema } from '../shared/schemas/media-gallery-schemas.js';
import { errorResponseSchema } from '../shared/schemas/common-schemas.js';
import { internalError } from '../shared/errors.js';

export async function mediaGalleryRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/users/me/media', {
    preHandler: requireAuth,
    schema: {
      querystring: mediaGalleryQuerySchema,
      response: {
        200: mediaGalleryResponseSchema,
        401: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const userId = request.requestContext!.userId;
    const { limit, offset } = request.query as { limit: number; offset: number };

    try {
      const { captures, total } = await findAllByUserId(userId, limit, offset);

      const items = await Promise.all(
        captures.map(async (capture) => {
          let url: string | null = null;
          try {
            const downloaded = await generateDownloadUrl(capture.storage_path);
            url = downloaded.url;
          } catch (error: unknown) {
            if (error instanceof StorageUnavailableError) {
              url = null;
            } else {
              throw error;
            }
          }
          return {
            id: capture.id,
            sessionId: capture.session_id,
            venueName: capture.venue_name,
            url,
            triggerType: capture.trigger_type,
            createdAt: capture.created_at.toISOString(),
            sessionDate: capture.session_created_at.toISOString(),
          };
        }),
      );

      return reply.send({ data: { captures: items, total } });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to load media gallery');
      throw internalError('Failed to load media gallery');
    }
  });
}
