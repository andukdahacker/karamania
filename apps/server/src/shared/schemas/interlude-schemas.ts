// Interlude Zod schemas — Socket.io-only, no globalRegistry needed (no REST endpoints)
// Used for type inference via z.infer<> and runtime validation in socket handlers

import { z } from 'zod';

export const activityVoteSchema = z.object({
  optionId: z.string().min(1),
});

export const activityVoteBroadcastSchema = z.object({
  optionId: z.string(),
  userId: z.string(),
  displayName: z.string(),
  voteCounts: z.record(z.string(), z.number()),
});

export const activityVoteStartedSchema = z.object({
  options: z.array(z.object({
    id: z.string(),
    name: z.string(),
    description: z.string(),
    icon: z.string(),
  })),
  voteDurationMs: z.number(),
  roundId: z.string(),
});

export const activityVoteResultSchema = z.object({
  winningOptionId: z.string(),
  voteCounts: z.record(z.string(), z.number()),
  totalVotes: z.number(),
});
