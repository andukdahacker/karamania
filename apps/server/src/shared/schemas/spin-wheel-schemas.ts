// Spin the Wheel Zod schemas — Socket.io-only, no globalRegistry needed (no REST endpoints)
// Used for z.infer<> and runtime validation in socket handlers only

import { z } from 'zod';

export const spinWheelSegmentSchema = z.object({
  catalogTrackId: z.string(),
  songTitle: z.string(),
  artist: z.string(),
  youtubeVideoId: z.string(),
  overlapCount: z.number(),
  segmentIndex: z.number(),
});

export const spinWheelActionSchema = z.object({
  action: z.enum(['spin', 'veto']),
});

export const songModeSchema = z.object({
  mode: z.enum(['quickPick', 'spinWheel']),
});
