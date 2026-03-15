import type { FastifyInstance } from 'fastify';
import * as catalogRepository from '../persistence/catalog-repository.js';
import type { KaraokeCatalogTable } from '../db/types.js';
import {
  catalogSearchQuerySchema,
  catalogSearchResponseSchema,
  catalogStatsResponseSchema,
  catalogClassicsResponseSchema,
} from '../shared/schemas/catalog-schemas.js';
import { errorResponseSchema } from '../shared/schemas/common-schemas.js';

function toTrackResponse(track: KaraokeCatalogTable) {
  return {
    id: track.id,
    songTitle: track.song_title,
    artist: track.artist,
    youtubeVideoId: track.youtube_video_id,
    channel: track.channel,
    isClassic: track.is_classic,
    createdAt: track.created_at,
    updatedAt: track.updated_at,
  };
}

export async function catalogRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get('/api/catalog/search', {
    schema: {
      querystring: catalogSearchQuerySchema,
      response: {
        200: catalogSearchResponseSchema,
        400: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const query = request.query as { q: string; limit: number; offset: number };

    const [tracks, total] = await Promise.all([
      catalogRepository.searchByTitleOrArtist(query.q, query.limit, query.offset),
      catalogRepository.countByTitleOrArtist(query.q),
    ]);

    return reply.send({
      data: {
        tracks: tracks.map(toTrackResponse),
        total,
        offset: query.offset,
        limit: query.limit,
      },
    });
  });

  fastify.get('/api/catalog/stats', {
    schema: {
      response: {
        200: catalogStatsResponseSchema,
      },
    },
  }, async (_request, reply) => {
    const [totalTracks, classicTracks] = await Promise.all([
      catalogRepository.getCount(),
      catalogRepository.getClassicsCount(),
    ]);

    return reply.send({
      data: {
        totalTracks,
        classicTracks,
      },
    });
  });

  fastify.get('/api/catalog/classics', {
    schema: {
      response: {
        200: catalogClassicsResponseSchema,
      },
    },
  }, async (_request, reply) => {
    const classics = await catalogRepository.findClassics();

    return reply.send({
      data: {
        tracks: classics.map(toTrackResponse),
      },
    });
  });
}
