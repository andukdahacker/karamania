import { z } from 'zod/v4';
import { dataResponseSchema } from './common-schemas.js';

export const captureMetadataSchema = z.object({
  captureType: z.enum(['photo', 'video', 'audio']),
  triggerType: z.enum(['session_start', 'reaction_peak', 'post_ceremony', 'session_end', 'manual']),
  durationMs: z.number().optional(),
  userId: z.string().optional(),
});
z.globalRegistry.add(captureMetadataSchema, { id: 'CaptureMetadata' });

export const captureResponseDataSchema = z.object({
  id: z.string(),
  sessionId: z.string(),
  storagePath: z.string(),
  triggerType: z.string(),
  createdAt: z.string(),
});
z.globalRegistry.add(captureResponseDataSchema, { id: 'CaptureResponseData' });

export const captureDataResponseSchema = dataResponseSchema(captureResponseDataSchema);
z.globalRegistry.add(captureDataResponseSchema, { id: 'CaptureResponse' });
