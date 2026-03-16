import { z } from 'zod/v4';
import { dataResponseSchema } from './common-schemas.js';

export const catalogTrackSchema = z.object({
  id: z.string(),
  songTitle: z.string(),
  artist: z.string(),
  youtubeVideoId: z.string(),
  channel: z.string().nullable(),
  isClassic: z.boolean(),
  createdAt: z.date(),
  updatedAt: z.date(),
});
z.globalRegistry.add(catalogTrackSchema, { id: 'CatalogTrack' });

export const catalogSearchQuerySchema = z.object({
  q: z.string().min(1),
  limit: z.coerce.number().int().min(1).max(100).optional().default(20),
  offset: z.coerce.number().int().min(0).optional().default(0),
});

const catalogSearchDataSchema = z.object({
  tracks: z.array(catalogTrackSchema),
  total: z.number(),
  offset: z.number(),
  limit: z.number(),
});
z.globalRegistry.add(catalogSearchDataSchema, { id: 'CatalogSearchData' });

export const catalogSearchResponseSchema = dataResponseSchema(catalogSearchDataSchema);
z.globalRegistry.add(catalogSearchResponseSchema, { id: 'CatalogSearchResponse' });

const catalogStatsDataSchema = z.object({
  totalTracks: z.number(),
  classicTracks: z.number(),
});
z.globalRegistry.add(catalogStatsDataSchema, { id: 'CatalogStatsData' });

export const catalogStatsResponseSchema = dataResponseSchema(catalogStatsDataSchema);
z.globalRegistry.add(catalogStatsResponseSchema, { id: 'CatalogStatsResponse' });

const catalogClassicsDataSchema = z.object({
  tracks: z.array(catalogTrackSchema),
});
z.globalRegistry.add(catalogClassicsDataSchema, { id: 'CatalogClassicsData' });

export const catalogClassicsResponseSchema = dataResponseSchema(catalogClassicsDataSchema);
z.globalRegistry.add(catalogClassicsResponseSchema, { id: 'CatalogClassicsResponse' });
