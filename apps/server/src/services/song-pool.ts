// In-memory session song pool — tracks imported catalog songs with overlap metadata
// Same pattern as dj-state-store.ts, event-stream.ts, connection-tracker.ts

import type { KaraokeCatalogTable } from '../db/types.js';
import { generateSongKey } from '../shared/song-normalizer.js';

export interface PooledSong {
  catalogTrackId: string;
  songTitle: string;
  artist: string;
  youtubeVideoId: string;
  channel: string | null;
  isClassic: boolean;
  overlapCount: number;
  importedBy: Set<string>;
}

export interface SessionSongPool {
  songs: Map<string, PooledSong>;
  sungSongKeys: Set<string>;
}

const pools = new Map<string, SessionSongPool>();

function getOrCreatePool(sessionId: string): SessionSongPool {
  let pool = pools.get(sessionId);
  if (!pool) {
    pool = { songs: new Map(), sungSongKeys: new Set() };
    pools.set(sessionId, pool);
  }
  return pool;
}

export function addImportedSongs(
  sessionId: string,
  userId: string,
  catalogTracks: KaraokeCatalogTable[],
): { newSongs: number; updatedOverlaps: number } {
  const pool = getOrCreatePool(sessionId);
  let newSongs = 0;
  let updatedOverlaps = 0;

  for (const track of catalogTracks) {
    const key = generateSongKey(track.song_title, track.artist);
    const existing = pool.songs.get(key);

    if (existing) {
      // Only increment overlap if this user hasn't already imported this song
      if (!existing.importedBy.has(userId)) {
        existing.importedBy.add(userId);
        existing.overlapCount = existing.importedBy.size;
        updatedOverlaps++;
      }
    } else {
      const importedBy = new Set<string>();
      importedBy.add(userId);
      pool.songs.set(key, {
        catalogTrackId: track.id,
        songTitle: track.song_title,
        artist: track.artist,
        youtubeVideoId: track.youtube_video_id,
        channel: track.channel,
        isClassic: track.is_classic,
        overlapCount: 1,
        importedBy,
      });
      newSongs++;
    }
  }

  return { newSongs, updatedOverlaps };
}

export function markSongSung(sessionId: string, title: string, artist: string): void {
  const pool = getOrCreatePool(sessionId);
  pool.sungSongKeys.add(generateSongKey(title, artist));
}

export function getPool(sessionId: string): SessionSongPool | undefined {
  return pools.get(sessionId);
}

export function getPooledSongs(sessionId: string): PooledSong[] {
  const pool = pools.get(sessionId);
  if (!pool) return [];
  return Array.from(pool.songs.values());
}

export function getSungSongKeys(sessionId: string): Set<string> {
  const pool = pools.get(sessionId);
  if (!pool) return new Set();
  return pool.sungSongKeys;
}

export function clearPool(sessionId: string): void {
  pools.delete(sessionId);
}

export function resetAllPools(): void {
  pools.clear();
}
