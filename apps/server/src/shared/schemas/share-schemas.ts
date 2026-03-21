import { z } from 'zod/v4';
import { dataResponseSchema } from './common-schemas.js';

export const shareSessionParticipantSchema = z.object({
  displayName: z.string(),
  participationScore: z.number(),
  topAward: z.string().nullable(),
});
z.globalRegistry.add(shareSessionParticipantSchema, { id: 'ShareSessionParticipant' });

export const shareSessionSetlistItemSchema = z.object({
  position: z.number(),
  title: z.string(),
  artist: z.string(),
  performerName: z.string().nullable(),
  awardTitle: z.string().nullable(),
  awardTone: z.string().nullable(),
});
z.globalRegistry.add(shareSessionSetlistItemSchema, { id: 'ShareSessionSetlistItem' });

export const shareSessionStatsSchema = z.object({
  songCount: z.number(),
  participantCount: z.number(),
  sessionDurationMs: z.number(),
  totalReactions: z.number(),
});
z.globalRegistry.add(shareSessionStatsSchema, { id: 'ShareSessionStats' });

export const shareSessionSchema = z.object({
  id: z.string(),
  venueName: z.string().nullable(),
  vibe: z.string().nullable(),
  createdAt: z.string(),
  endedAt: z.string().nullable(),
  stats: shareSessionStatsSchema,
  participants: z.array(shareSessionParticipantSchema),
  setlist: z.array(shareSessionSetlistItemSchema),
  mediaUrls: z.array(z.string()),
});
z.globalRegistry.add(shareSessionSchema, { id: 'ShareSession' });

export const shareSessionResponseSchema = dataResponseSchema(shareSessionSchema);
z.globalRegistry.add(shareSessionResponseSchema, { id: 'ShareSessionResponse' });
