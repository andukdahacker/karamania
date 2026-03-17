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

export const songDetectedSchema = z.object({
  videoId: z.string(),
  songTitle: z.string(),
  artist: z.string().nullable(),
  channel: z.string().nullable(),
  thumbnail: z.string().nullable(),
  source: z.enum(['catalog', 'api-parsed', 'api-raw']),
});
