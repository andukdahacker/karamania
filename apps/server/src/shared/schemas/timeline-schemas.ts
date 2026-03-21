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

// Session Detail schemas (Story 9.4)
export const sessionDetailParticipantSchema = z.object({
  userId: z.string().nullable(),
  displayName: z.string(),
  participationScore: z.number().int(),
  topAward: z.string().nullable(),
});
z.globalRegistry.add(sessionDetailParticipantSchema, { id: 'SessionDetailParticipant' });

export const sessionDetailSetlistItemSchema = z.object({
  position: z.number().int(),
  title: z.string(),
  artist: z.string(),
  performerName: z.string().nullable(),
  awardTitle: z.string().nullable(),
  awardTone: z.string().nullable(),
});
z.globalRegistry.add(sessionDetailSetlistItemSchema, { id: 'SessionDetailSetlistItem' });

export const sessionDetailAwardSchema = z.object({
  userId: z.string().nullable(),
  displayName: z.string(),
  category: z.string(),
  title: z.string(),
  tone: z.string(),
  reason: z.string(),
});
z.globalRegistry.add(sessionDetailAwardSchema, { id: 'SessionDetailAward' });

export const sessionDetailMediaSchema = z.object({
  id: z.string(),
  url: z.string().nullable(),
  triggerType: z.string(),
  createdAt: z.string(),
});
z.globalRegistry.add(sessionDetailMediaSchema, { id: 'SessionDetailMedia' });

export const sessionDetailStatsSchema = z.object({
  songCount: z.number().int(),
  participantCount: z.number().int(),
  sessionDurationMs: z.number().int(),
  totalReactions: z.number().int(),
  totalSoundboardPlays: z.number().int(),
  totalCardsDealt: z.number().int(),
});
z.globalRegistry.add(sessionDetailStatsSchema, { id: 'SessionDetailStats' });

export const sessionDetailSchema = z.object({
  id: z.string(),
  venueName: z.string().nullable(),
  vibe: z.string().nullable(),
  createdAt: z.string(),
  endedAt: z.string().nullable(),
  stats: sessionDetailStatsSchema,
  participants: z.array(sessionDetailParticipantSchema),
  setlist: z.array(sessionDetailSetlistItemSchema),
  awards: z.array(sessionDetailAwardSchema),
  media: z.array(sessionDetailMediaSchema),
});
z.globalRegistry.add(sessionDetailSchema, { id: 'SessionDetail' });

export const sessionDetailResponseSchema = dataResponseSchema(sessionDetailSchema);
z.globalRegistry.add(sessionDetailResponseSchema, { id: 'SessionDetailResponse' });
