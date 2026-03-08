import { z } from 'zod/v4';
import { VALID_VIBES } from '../constants.js';

export const createSessionRequestSchema = z.object({
  displayName: z.string().min(1).max(30).optional(),
  vibe: z.enum(VALID_VIBES).optional(),
  venueName: z.string().max(100).optional(),
});

export const createSessionResponseDataSchema = z.object({
  sessionId: z.string(),
  partyCode: z.string(),
  token: z.string().optional(),
  guestId: z.string().optional(),
});
