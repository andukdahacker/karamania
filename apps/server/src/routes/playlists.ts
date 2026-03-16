import type { FastifyInstance } from 'fastify';
import * as catalogRepository from '../persistence/catalog-repository.js';
import * as sessionRepo from '../persistence/session-repository.js';
import type { KaraokeCatalogTable } from '../db/types.js';
import { extractPlaylistId, fetchPlaylistTracks } from '../integrations/youtube-data.js';
import { extractPlaylistId as extractSpotifyId, fetchPlaylistTracks as fetchSpotifyTracks } from '../integrations/spotify-data.js';
import { config } from '../config.js';
import {
  playlistImportRequestSchema,
  playlistImportResponseSchema,
} from '../shared/schemas/playlist-schemas.js';
import { errorResponseSchema } from '../shared/schemas/common-schemas.js';
import { addImportedSongs, getPooledSongs } from '../services/song-pool.js';
import { verifyFirebaseToken } from '../integrations/firebase-admin.js';
import { verifyGuestToken } from '../services/guest-token.js';

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
        401: errorResponseSchema,
        403: errorResponseSchema,
        404: errorResponseSchema,
        502: errorResponseSchema,
      },
    },
  }, async (request, reply) => {
    const { playlistUrl, sessionId } = request.body as { playlistUrl: string; sessionId?: string };
    const youtubeId = extractPlaylistId(playlistUrl);
    const spotifyId = extractSpotifyId(playlistUrl);

    if (!youtubeId && !spotifyId) {
      return reply.status(400).send({
        error: { code: 'INVALID_PLAYLIST_URL', message: 'URL must be a YouTube Music, YouTube, or Spotify playlist URL' },
      });
    }

    // Extract userId from auth header (required when sessionId is provided)
    let userId: string | null = null;
    if (sessionId) {
      const authHeader = request.headers.authorization;
      if (!authHeader?.startsWith('Bearer ')) {
        return reply.status(401).send({ error: { code: 'AUTH_REQUIRED', message: 'Authorization required when sessionId is provided' } });
      }
      const token = authHeader.slice(7);
      try {
        // Try Firebase first, fall back to guest token
        const decoded = await verifyFirebaseToken(token);
        userId = decoded.uid;
      } catch {
        try {
          const guest = await verifyGuestToken(token);
          userId = guest.guestId;
        } catch {
          return reply.status(401).send({ error: { code: 'AUTH_INVALID', message: 'Invalid token' } });
        }
      }
    }

    try {
      const result = youtubeId
        ? await fetchPlaylistTracks(youtubeId, config.YOUTUBE_API_KEY)
        : await fetchSpotifyTracks(spotifyId!, config.SPOTIFY_CLIENT_ID, config.SPOTIFY_CLIENT_SECRET);

      const titles = result.tracks.map((t) => t.songTitle);
      const artists = result.tracks.map((t) => t.artist);
      const matches = titles.length > 0
        ? await catalogRepository.intersectWithSongs(titles, artists)
        : [];

      // Store in session pool if sessionId + userId available
      let poolStats: { newSongs: number; updatedOverlaps: number; totalPoolSize: number } | undefined;
      if (sessionId && userId) {
        // Verify session exists and is active
        const session = await sessionRepo.findById(sessionId);
        if (!session || (session.status !== 'lobby' && session.status !== 'active')) {
          return reply.status(400).send({
            error: { code: 'INVALID_SESSION', message: 'Session not found or ended' },
          });
        }

        const stats = addImportedSongs(sessionId, userId, matches);
        poolStats = {
          newSongs: stats.newSongs,
          updatedOverlaps: stats.updatedOverlaps,
          totalPoolSize: getPooledSongs(sessionId).length,
        };
      }

      return reply.send({
        data: {
          tracks: result.tracks,
          matched: matches.map(toTrackResponse),
          unmatchedCount: result.tracks.length - matches.length,
          totalFetched: result.totalFetched,
          poolStats,
        },
      });
    } catch (error) {
      const msg = (error as Error).message;
      if (msg.includes('not found')) {
        return reply.status(404).send({
          error: { code: 'PLAYLIST_NOT_FOUND', message: msg },
        });
      }
      if (msg.includes('private')) {
        return reply.status(403).send({
          error: { code: 'PLAYLIST_PRIVATE', message: msg },
        });
      }
      const code = youtubeId ? 'YOUTUBE_API_FAILED' : 'SPOTIFY_API_FAILED';
      return reply.status(502).send({
        error: { code, message: msg },
      });
    }
  });
}
