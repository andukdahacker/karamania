import { z } from 'zod/v4';
import { dataResponseSchema } from './common-schemas.js';

export const upgradeRequestSchema = z.object({
  firebaseToken: z.string().min(1),
  guestId: z.string().uuid(),
  sessionId: z.string().uuid(),
  guestDisplayName: z.string().min(1),
  captureIds: z.array(z.string()).optional().default([]),
});
z.globalRegistry.add(upgradeRequestSchema, { id: 'UpgradeRequest' });

export const upgradeResponseDataSchema = z.object({
  userId: z.string(),
  displayName: z.string(),
  avatarUrl: z.string().nullable(),
  createdAt: z.string(),
  linkedParticipant: z.boolean(),
  linkedCaptureCount: z.number(),
});
z.globalRegistry.add(upgradeResponseDataSchema, { id: 'UpgradeResponseData' });

export const upgradeResponseSchema = dataResponseSchema(upgradeResponseDataSchema);
z.globalRegistry.add(upgradeResponseSchema, { id: 'UpgradeResponse' });
