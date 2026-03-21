import { z } from 'zod/v4';
import { dataResponseSchema } from './common-schemas.js';

export const sessionTimelineItemSchema = z.object({
  id: z.string(),
  venueName: z.string().nullable(),
  endedAt: z.string().nullable(),
  participantCount: z.number(),
  topAward: z.string().nullable(),
  thumbnailUrl: z.string().nullable(),
});
z.globalRegistry.add(sessionTimelineItemSchema, { id: 'SessionTimelineItem' });

const sessionTimelineDataSchema = z.object({
  sessions: z.array(sessionTimelineItemSchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});
z.globalRegistry.add(sessionTimelineDataSchema, { id: 'SessionTimelineData' });

export const sessionTimelineResponseSchema = dataResponseSchema(sessionTimelineDataSchema);
z.globalRegistry.add(sessionTimelineResponseSchema, { id: 'SessionTimelineResponse' });

export const sessionTimelineQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});
