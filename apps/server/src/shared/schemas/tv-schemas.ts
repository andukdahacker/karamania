import { z } from 'zod';

export const tvPairSchema = z.object({
  pairingCode: z.string().min(1).max(20),
});

export const tvStatusSchema = z.object({
  status: z.enum(['disconnected', 'connecting', 'connected', 'reconnecting']),
  message: z.string().optional(),
});

export const tvNowPlayingSchema = z.object({
  videoId: z.string(),
  title: z.string().optional(),
  state: z.enum(['playing', 'paused', 'buffering', 'idle']),
});
