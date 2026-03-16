import { z } from 'zod/v4';
import { dataResponseSchema } from './common-schemas.js';

export const suggestedSongSchema = z.object({
  catalogTrackId: z.string(),
  songTitle: z.string(),
  artist: z.string(),
  youtubeVideoId: z.string(),
  overlapCount: z.number(),
  score: z.number(),
});
z.globalRegistry.add(suggestedSongSchema, { id: 'SuggestedSong' });

export const suggestionsQuerySchema = z.object({
  count: z.coerce.number().int().min(1).max(20).optional().default(5),
});
z.globalRegistry.add(suggestionsQuerySchema, { id: 'SuggestionsQuery' });

export const suggestionsResponseSchema = dataResponseSchema(z.object({
  suggestions: z.array(suggestedSongSchema),
}));
z.globalRegistry.add(suggestionsResponseSchema, { id: 'SuggestionsResponse' });
