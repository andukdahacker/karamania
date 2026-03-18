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

export const uploadUrlResponseDataSchema = z.object({
  uploadUrl: z.string(),
  storagePath: z.string(),
});
z.globalRegistry.add(uploadUrlResponseDataSchema, { id: 'UploadUrlResponseData' });

export const uploadUrlResponseSchema = dataResponseSchema(uploadUrlResponseDataSchema);
z.globalRegistry.add(uploadUrlResponseSchema, { id: 'UploadUrlResponse' });

export const downloadUrlResponseDataSchema = z.object({
  downloadUrl: z.string(),
  expiresAt: z.string(),
});
z.globalRegistry.add(downloadUrlResponseDataSchema, { id: 'DownloadUrlResponseData' });

export const downloadUrlResponseSchema = dataResponseSchema(downloadUrlResponseDataSchema);
z.globalRegistry.add(downloadUrlResponseSchema, { id: 'DownloadUrlResponse' });

export const mediaListResponseDataSchema = z.object({
  captures: z.array(captureResponseDataSchema.extend({ downloadUrl: z.string().optional() })),
});
z.globalRegistry.add(mediaListResponseDataSchema, { id: 'MediaListResponseData' });

export const mediaListResponseSchema = dataResponseSchema(mediaListResponseDataSchema);
z.globalRegistry.add(mediaListResponseSchema, { id: 'MediaListResponse' });
