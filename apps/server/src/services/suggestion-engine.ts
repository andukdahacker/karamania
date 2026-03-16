// Suggestion engine — ranking logic with cold-start fallback via catalog-repository
// Reads from song-pool (in-memory) and catalog-repository (persistence for classics)

import * as catalogRepository from '../persistence/catalog-repository.js';
import { getPooledSongs, getSungSongKeys } from './song-pool.js';
import { generateSongKey } from '../shared/song-normalizer.js';
import type { PooledSong } from './song-pool.js';

export interface SuggestedSong {
  catalogTrackId: string;
  songTitle: string;
  artist: string;
  youtubeVideoId: string;
  overlapCount: number;
  score: number;
}

export function rankSong(song: PooledSong, sungSongKeys: Set<string>): number {
  const key = generateSongKey(song.songTitle, song.artist);

  // Base score: overlap count is most important (FR87 priority 1)
  let score = song.overlapCount * 100;

  // TODO: Genre momentum ranking -- requires genre column in karaoke_catalog (see Story 5.4 notes)

  // Not-yet-sung bonus / already-sung penalty (FR87 priority 3)
  if (sungSongKeys.has(key)) {
    score -= 200;
  } else {
    score += 50;
  }

  // Tiebreaker: small random jitter
  score += Math.random() * 10;

  return score;
}

export async function computeSuggestions(sessionId: string, count: number): Promise<SuggestedSong[]> {
  const pooledSongs = getPooledSongs(sessionId);

  // Cold start fallback (FR91)
  if (pooledSongs.length === 0) {
    const classics = await catalogRepository.findClassics();
    if (classics.length === 0) return [];

    const suggestions: SuggestedSong[] = classics.map((track) => ({
      catalogTrackId: track.id,
      songTitle: track.song_title,
      artist: track.artist,
      youtubeVideoId: track.youtube_video_id,
      overlapCount: 0,
      score: 0,
    }));

    // Shuffle randomly (Fisher-Yates)
    for (let i = suggestions.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [suggestions[i], suggestions[j]] = [suggestions[j]!, suggestions[i]!];
    }

    return suggestions.slice(0, count);
  }

  const sungSongKeys = getSungSongKeys(sessionId);

  const scored: SuggestedSong[] = pooledSongs.map((song) => ({
    catalogTrackId: song.catalogTrackId,
    songTitle: song.songTitle,
    artist: song.artist,
    youtubeVideoId: song.youtubeVideoId,
    overlapCount: song.overlapCount,
    score: rankSong(song, sungSongKeys),
  }));

  scored.sort((a, b) => b.score - a.score);

  return scored.slice(0, count);
}
