import { z } from 'zod/v4';
import { dataResponseSchema } from './common-schemas.js';

export const guestAuthRequestSchema = z.object({
  displayName: z.string().min(1).max(30),
  partyCode: z.string().min(4).max(6),
});

export const guestAuthResponseSchema = dataResponseSchema(
  z.object({
    token: z.string(),
    guestId: z.string(),
  })
);
