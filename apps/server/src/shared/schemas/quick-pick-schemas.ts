// Quick Pick Zod schemas — Socket.io-only, no globalRegistry needed (no REST endpoints)
// Used for type inference via z.infer<> only

import { z } from 'zod';

export const quickPickSongSchema = z.object({
  catalogTrackId: z.string(),
  songTitle: z.string(),
  artist: z.string(),
  youtubeVideoId: z.string(),
  overlapCount: z.number(),
});

export const quickPickVoteSchema = z.object({
  catalogTrackId: z.string(),
  vote: z.enum(['up', 'skip']),
});

export const quickPickVoteBroadcastSchema = z.object({
  catalogTrackId: z.string(),
  userId: z.string(),
  displayName: z.string(),
  vote: z.enum(['up', 'skip']),
  songVotes: z.object({
    up: z.number(),
    skip: z.number(),
  }),
});
