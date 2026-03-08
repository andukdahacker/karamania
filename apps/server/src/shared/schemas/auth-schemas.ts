import { z } from 'zod/v4';
import { dataResponseSchema } from './common-schemas.js';

export const guestAuthRequestSchema = z.object({
  displayName: z.string().min(1).max(30),
  partyCode: z.string().min(4).max(6),
});
z.globalRegistry.add(guestAuthRequestSchema, { id: 'GuestAuthRequest' });

export const guestAuthDataSchema = z.object({
  token: z.string(),
  guestId: z.string(),
  sessionId: z.string(),
  vibe: z.string(),
});
z.globalRegistry.add(guestAuthDataSchema, { id: 'GuestAuthData' });

export const guestAuthResponseSchema = dataResponseSchema(guestAuthDataSchema);
z.globalRegistry.add(guestAuthResponseSchema, { id: 'GuestAuthResponse' });
