import { z } from 'zod/v4';
import { VALID_VIBES } from '../constants.js';
import { dataResponseSchema } from './common-schemas.js';

export const createSessionRequestSchema = z.object({
  displayName: z.string().min(1).max(30).optional(),
  vibe: z.enum(VALID_VIBES).optional(),
  venueName: z.string().max(100).optional(),
});
z.globalRegistry.add(createSessionRequestSchema, { id: 'CreateSessionRequest' });

export const createSessionResponseDataSchema = z.object({
  sessionId: z.string(),
  partyCode: z.string(),
  token: z.string().optional(),
  guestId: z.string().optional(),
});
z.globalRegistry.add(createSessionResponseDataSchema, { id: 'CreateSessionData' });

export const createSessionResponseSchema = dataResponseSchema(
  createSessionResponseDataSchema,
);
z.globalRegistry.add(createSessionResponseSchema, { id: 'CreateSessionResponse' });
