import { z } from 'zod/v4';
import type { FastifyInstance, FastifyRequest } from 'fastify';
import { decodeProtectedHeader } from 'jose';
import * as mediaRepository from '../persistence/media-repository.js';
import * as sessionRepository from '../persistence/session-repository.js';
import { verifyFirebaseToken } from '../integrations/firebase-admin.js';
import { verifyGuestToken } from '../services/guest-token.js';
import {
  generateUploadUrl,
  generateDownloadUrl,
  fileExists,
  getContentType,
  StorageUnavailableError,
} from '../services/media-storage.js';
import {
  captureMetadataSchema,
  captureDataResponseSchema,
  uploadUrlResponseSchema,
  downloadUrlResponseSchema,
  mediaListResponseSchema,
} from '../shared/schemas/capture-schemas.js';
import { errorResponseSchema } from '../shared/schemas/common-schemas.js';
import { internalError } from '../shared/errors.js';

const captureParamsSchema = z.object({
  sessionId: z.string(),
});

const captureIdParamsSchema = z.object({
  sessionId: z.string(),
  captureId: z.string(),
});

interface RequestIdentity {
  userId: string;
  role: 'authenticated' | 'guest';
  sessionId?: string;
}

async function extractRequestIdentity(request: FastifyRequest): Promise<RequestIdentity | null> {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) return null;

  const token = authHeader.slice(7);
  try {
    const header = decodeProtectedHeader(token);

    if (header.kid) {
      try {
        const decodedToken = await verifyFirebaseToken(token);
        return { userId: decodedToken.uid, role: 'authenticated' };
      } catch {
        return null;
      }
    } else if (header.alg === 'HS256') {
      try {
        const payload = await verifyGuestToken(token);
        return { userId: payload.guestId, role: 'guest', sessionId: payload.sessionId };
      } catch {
        return null;
      }
    }

    return null;
  } catch {
    return null;
  }
}

export async function captureRoutes(fastify: FastifyInstance): Promise<void> {
  // POST /api/sessions/:sessionId/captures (existing - unauthenticated)
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

  // GET /api/sessions/:sessionId/captures
  fastify.get('/api/sessions/:sessionId/captures', {
    schema: {
      params: captureParamsSchema,
      response: {
        200: mediaListResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { sessionId } = request.params as { sessionId: string };
    const identity = await extractRequestIdentity(request);
    if (!identity) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    }

    const isParticipant = await sessionRepository.isSessionParticipant(sessionId, identity.userId);
    if (!isParticipant) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Not a participant in this session' } });
    }

    try {
      const records = await mediaRepository.findBySessionId(sessionId);
      const captures = records.map((r) => ({
        id: r.id,
        sessionId: r.session_id,
        storagePath: r.storage_path,
        triggerType: r.trigger_type,
        createdAt: r.created_at.toISOString(),
      }));

      return reply.send({ data: { captures } });
    } catch (error) {
      request.log.error({ err: error }, 'Failed to list captures');
      throw internalError('Failed to list captures');
    }
  });

  // GET /api/sessions/:sessionId/captures/:captureId/upload-url
  fastify.get('/api/sessions/:sessionId/captures/:captureId/upload-url', {
    schema: {
      params: captureIdParamsSchema,
      response: {
        200: uploadUrlResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { sessionId, captureId } = request.params as { sessionId: string; captureId: string };
    const identity = await extractRequestIdentity(request);
    if (!identity) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    }

    const capture = await mediaRepository.findById(captureId);
    if (!capture || capture.session_id !== sessionId) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Capture not found' } });
    }

    if (capture.user_id !== identity.userId) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Not the owner of this capture' } });
    }

    try {
      const contentType = getContentType(capture.storage_path);
      const uploadUrl = await generateUploadUrl(capture.storage_path, contentType);
      return reply.send({ data: { uploadUrl, storagePath: capture.storage_path } });
    } catch (error) {
      if (error instanceof StorageUnavailableError) {
        return reply.status(500).send({ error: { code: 'STORAGE_UNAVAILABLE', message: 'Firebase Storage not configured' } });
      }
      request.log.error({ err: error }, 'Failed to generate upload URL');
      throw internalError('Failed to generate upload URL');
    }
  });

  // GET /api/sessions/:sessionId/captures/:captureId/download-url
  fastify.get('/api/sessions/:sessionId/captures/:captureId/download-url', {
    schema: {
      params: captureIdParamsSchema,
      response: {
        200: downloadUrlResponseSchema,
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
        500: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { sessionId, captureId } = request.params as { sessionId: string; captureId: string };
    const identity = await extractRequestIdentity(request);
    if (!identity) {
      return reply.status(401).send({ error: { code: 'UNAUTHORIZED', message: 'Unauthorized' } });
    }

    const capture = await mediaRepository.findById(captureId);
    if (!capture || capture.session_id !== sessionId) {
      return reply.status(404).send({ error: { code: 'NOT_FOUND', message: 'Capture not found' } });
    }

    const isParticipant = await sessionRepository.isSessionParticipant(sessionId, identity.userId);
    if (!isParticipant) {
      return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Not a participant in this session' } });
    }

    if (identity.role === 'guest') {
      const session = await sessionRepository.findById(sessionId);
      if (session?.ended_at) {
        const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;
        const sessionEndedAt = new Date(session.ended_at).getTime();
        if (Date.now() - sessionEndedAt > sevenDaysMs) {
          return reply.status(403).send({ error: { code: 'FORBIDDEN', message: 'Guest media access expired' } });
        }
      }
    }

    const exists = await fileExists(capture.storage_path).catch(() => false);
    if (!exists) {
      return reply.status(404).send({ error: { code: 'FILE_NOT_FOUND', message: 'Media file not yet uploaded' } });
    }

    try {
      const { url, expiresAt } = await generateDownloadUrl(capture.storage_path);
      return reply.send({ data: { downloadUrl: url, expiresAt: expiresAt.toISOString() } });
    } catch (error) {
      if (error instanceof StorageUnavailableError) {
        return reply.status(500).send({ error: { code: 'STORAGE_UNAVAILABLE', message: 'Firebase Storage not configured' } });
      }
      request.log.error({ err: error }, 'Failed to generate download URL');
      throw internalError('Failed to generate download URL');
    }
  });
}
