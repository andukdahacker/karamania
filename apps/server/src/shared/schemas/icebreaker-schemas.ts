// Icebreaker event Zod schemas — Socket.io only, no REST endpoints
import { z } from 'zod';

export const icebreakerVoteSchema = z.object({
  optionId: z.string().min(1),
});

export const icebreakerStartedSchema = z.object({
  question: z.string().min(1),
  options: z.array(z.object({
    id: z.string().min(1),
    label: z.string().min(1),
    emoji: z.string().min(1),
  })).length(4),
  voteDurationMs: z.number(),
});

export const icebreakerResultSchema = z.object({
  optionCounts: z.record(z.string(), z.number()),
  totalVotes: z.number().int().nonnegative(),
  winnerOptionId: z.string().min(1),
});
