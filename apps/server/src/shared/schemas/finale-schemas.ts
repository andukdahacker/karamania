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
