import { z } from 'zod/v4';
import type { FastifyInstance } from 'fastify';
import * as mediaRepository from '../persistence/media-repository.js';
import { captureMetadataSchema, captureDataResponseSchema } from '../shared/schemas/capture-schemas.js';
import { errorResponseSchema } from '../shared/schemas/common-schemas.js';
import { internalError } from '../shared/errors.js';

const captureParamsSchema = z.object({
  sessionId: z.string(),
});

export async function captureRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/sessions/:sessionId/captures', {
    schema: {
      params: captureParamsSchema,
      body: captureMetadataSchema,
      response: {
        201: captureDataResponseSchema,
        400: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const body = request.body as { captureType: string; triggerType: string; durationMs?: number; userId?: string };

    const captureId = crypto.randomUUID();
    const ext = body.captureType === 'photo' ? 'jpg'
      : body.captureType === 'video' ? 'mp4'
      : 'm4a';
    const storagePath = `${sessionId}/${captureId}.${ext}`;

    try {
      const record = await mediaRepository.create({
        id: captureId,
        sessionId,
        userId: body.userId ?? null,
        storagePath,
        triggerType: body.triggerType,
        djStateAtCapture: null,
      });

      return reply.status(201).send({
        data: {
          id: record.id,
          sessionId: record.session_id,
          storagePath: record.storage_path,
          triggerType: record.trigger_type,
          createdAt: record.created_at.toISOString(),
        },
      });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to create capture metadata');
      throw internalError('Failed to create capture metadata');
    }
  });
}
