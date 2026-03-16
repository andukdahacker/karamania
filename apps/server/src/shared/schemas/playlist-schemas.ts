import { z } from 'zod/v4';
import { dataResponseSchema } from './common-schemas.js';
import { catalogTrackSchema } from './catalog-schemas.js';

export const playlistImportRequestSchema = z.object({
  playlistUrl: z.string().url(),
  sessionId: z.string().uuid().optional(),
});
z.globalRegistry.add(playlistImportRequestSchema, { id: 'PlaylistImportRequest' });

export const playlistTrackSchema = z.object({
  songTitle: z.string(),
  artist: z.string(),
  youtubeVideoId: z.string(),
});
z.globalRegistry.add(playlistTrackSchema, { id: 'PlaylistTrack' });

const poolStatsSchema = z.object({
  newSongs: z.number(),
  updatedOverlaps: z.number(),
  totalPoolSize: z.number(),
});
z.globalRegistry.add(poolStatsSchema, { id: 'PoolStats' });

const playlistImportDataSchema = z.object({
  tracks: z.array(playlistTrackSchema),
  matched: z.array(catalogTrackSchema),
  unmatchedCount: z.number(),
  totalFetched: z.number(),
  poolStats: poolStatsSchema.optional(),
});
z.globalRegistry.add(playlistImportDataSchema, { id: 'PlaylistImportData' });

export const playlistImportResponseSchema = dataResponseSchema(playlistImportDataSchema);
z.globalRegistry.add(playlistImportResponseSchema, { id: 'PlaylistImportResponse' });
