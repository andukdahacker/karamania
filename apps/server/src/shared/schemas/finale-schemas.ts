import { z } from 'zod';

export const finaleAwardCategorySchema = z.enum([
  'performer',
  'hypeLeader',
  'socialButterfly',
  'crowdFavorite',
  'partyStarter',
  'vibeKeeper',
  'everyone',
]);

export const awardToneSchema = z.enum(['comedic', 'hype', 'absurd', 'wholesome']);

export const finaleAwardSchema = z.object({
  userId: z.string().min(1),
  displayName: z.string().min(1),
  category: finaleAwardCategorySchema,
  title: z.string().min(1),
  tone: awardToneSchema,
  reason: z.string().min(1),
});

export const finaleAwardsPayloadSchema = z.array(finaleAwardSchema);

export type FinaleAwardSchema = z.infer<typeof finaleAwardSchema>;
export type FinaleAwardsPayloadSchema = z.infer<typeof finaleAwardsPayloadSchema>;

// Story 8.2: Session stats schema
export const sessionStatsSchema = z.object({
  songCount: z.number().int(),
  participantCount: z.number().int(),
  sessionDurationMs: z.number().int(),
  totalReactions: z.number().int(),
  totalSoundboardPlays: z.number().int(),
  totalCardsDealt: z.number().int(),
  topReactor: z.object({
    displayName: z.string().min(1),
    count: z.number().int(),
  }).nullable(),
  longestStreak: z.number().int(),
});

export type SessionStats = z.infer<typeof sessionStatsSchema>;

// Story 8.2: Setlist entry schema
export const setlistEntrySchema = z.object({
  position: z.number().int(),
  title: z.string(),
  artist: z.string(),
  performerName: z.string().nullable(),
  awardTitle: z.string().nullable(),
  awardTone: z.string().nullable(),
});

export type SetlistEntry = z.infer<typeof setlistEntrySchema>;

// Story 8.2: Feedback payload schema
export const feedbackPayloadSchema = z.object({
  score: z.number().int().min(1).max(5),
});
