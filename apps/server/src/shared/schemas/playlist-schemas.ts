import { z } from 'zod/v4';
import { dataResponseSchema } from './common-schemas.js';
import { catalogTrackSchema } from './catalog-schemas.js';

export const playlistImportRequestSchema = z.object({
  playlistUrl: z.string().url(),
});
z.globalRegistry.add(playlistImportRequestSchema, { id: 'PlaylistImportRequest' });

export const playlistTrackSchema = z.object({
  songTitle: z.string(),
  artist: z.string(),
  youtubeVideoId: z.string(),
});
z.globalRegistry.add(playlistTrackSchema, { id: 'PlaylistTrack' });

const playlistImportDataSchema = z.object({
  tracks: z.array(playlistTrackSchema),
  matched: z.array(catalogTrackSchema),
  unmatchedCount: z.number(),
  totalFetched: z.number(),
});
z.globalRegistry.add(playlistImportDataSchema, { id: 'PlaylistImportData' });

export const playlistImportResponseSchema = dataResponseSchema(playlistImportDataSchema);
z.globalRegistry.add(playlistImportResponseSchema, { id: 'PlaylistImportResponse' });
