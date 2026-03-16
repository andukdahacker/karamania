import type { FastifyInstance } from 'fastify';
import * as catalogRepository from '../persistence/catalog-repository.js';
import type { KaraokeCatalogTable } from '../db/types.js';
import { extractPlaylistId, fetchPlaylistTracks } from '../integrations/youtube-data.js';
import { config } from '../config.js';
import {
  playlistImportRequestSchema,
  playlistImportResponseSchema,
} from '../shared/schemas/playlist-schemas.js';
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

export async function playlistRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.post('/api/playlists/import', {
    schema: {
      body: playlistImportRequestSchema,
      response: {
        200: playlistImportResponseSchema,
        400: errorResponseSchema,
        502: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { playlistUrl } = request.body as { playlistUrl: string };
    const playlistId = extractPlaylistId(playlistUrl);

    if (!playlistId) {
      return reply.status(400).send({
        error: { code: 'INVALID_PLAYLIST_URL', message: 'URL must be a YouTube Music or YouTube playlist URL' },
      });
    }

    try {
      const result = await fetchPlaylistTracks(playlistId, config.YOUTUBE_API_KEY);

      const titles = result.tracks.map((t) => t.songTitle);
      const artists = result.tracks.map((t) => t.artist);
      const matches = titles.length > 0
        ? await catalogRepository.intersectWithSongs(titles, artists)
        : [];

      return reply.send({
        data: {
          tracks: result.tracks,
          matched: matches.map(toTrackResponse),
          unmatchedCount: result.tracks.length - matches.length,
          totalFetched: result.totalFetched,
        },
      });
    } catch (error) {
      return reply.status(502).send({
        error: { code: 'YOUTUBE_API_FAILED', message: (error as Error).message },
      });
    }
  });
}
