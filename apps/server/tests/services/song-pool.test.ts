import { describe, it, expect, afterEach } from 'vitest';
import {
  addImportedSongs,
  markSongSung,
  getPool,
  getPooledSongs,
  getSungSongKeys,
  clearPool,
  resetAllPools,
} from '../../src/services/song-pool.js';
import { createTestCatalogTrack } from '../factories/catalog.js';

describe('song-pool', () => {
  afterEach(() => {
    resetAllPools();
  });

  const SESSION_ID = 's0000000-0000-0000-0000-000000000001';
  const USER_A = 'u0000000-0000-0000-0000-00000000000a';
  const USER_B = 'u0000000-0000-0000-0000-00000000000b';

  describe('addImportedSongs', () => {
    it('adds songs to a new pool', () => {
      const tracks = [
        createTestCatalogTrack({ song_title: 'Hello', artist: 'Adele' }),
        createTestCatalogTrack({ song_title: 'Bohemian Rhapsody', artist: 'Queen' }),
      ];

      const result = addImportedSongs(SESSION_ID, USER_A, tracks);

      expect(result.newSongs).toBe(2);
      expect(result.updatedOverlaps).toBe(0);
      expect(getPooledSongs(SESSION_ID)).toHaveLength(2);
    });

    it('increments overlap count for duplicate songs from different users', () => {
      const track = createTestCatalogTrack({ song_title: 'Hello', artist: 'Adele' });

      addImportedSongs(SESSION_ID, USER_A, [track]);
      const result = addImportedSongs(SESSION_ID, USER_B, [track]);

      expect(result.newSongs).toBe(0);
      expect(result.updatedOverlaps).toBe(1);

      const songs = getPooledSongs(SESSION_ID);
      expect(songs).toHaveLength(1);
      expect(songs[0]!.overlapCount).toBe(2);
    });

    it('does NOT double-count same user importing same song (idempotent via Set)', () => {
      const track = createTestCatalogTrack({ song_title: 'Hello', artist: 'Adele' });

      addImportedSongs(SESSION_ID, USER_A, [track]);
      // Same user imports again (e.g., from YouTube after Spotify)
      const result = addImportedSongs(SESSION_ID, USER_A, [track]);

      expect(result.newSongs).toBe(0);
      expect(result.updatedOverlaps).toBe(0);

      const songs = getPooledSongs(SESSION_ID);
      expect(songs).toHaveLength(1);
      expect(songs[0]!.overlapCount).toBe(1);
    });

    it('tracks importedBy users correctly', () => {
      const track = createTestCatalogTrack({ song_title: 'Hello', artist: 'Adele' });

      addImportedSongs(SESSION_ID, USER_A, [track]);
      addImportedSongs(SESSION_ID, USER_B, [track]);

      const songs = getPooledSongs(SESSION_ID);
      expect(songs[0]!.importedBy.size).toBe(2);
      expect(songs[0]!.importedBy.has(USER_A)).toBe(true);
      expect(songs[0]!.importedBy.has(USER_B)).toBe(true);
    });
  });

  describe('markSongSung', () => {
    it('adds song key to sung set', () => {
      markSongSung(SESSION_ID, 'Hello', 'Adele');
      const sungKeys = getSungSongKeys(SESSION_ID);
      expect(sungKeys.has('hello::adele')).toBe(true);
    });

    it('getSungSongKeys returns correct set', () => {
      markSongSung(SESSION_ID, 'Hello', 'Adele');
      markSongSung(SESSION_ID, 'Bohemian Rhapsody', 'Queen');
      const sungKeys = getSungSongKeys(SESSION_ID);
      expect(sungKeys.size).toBe(2);
    });
  });

  describe('clearPool', () => {
    it('removes all data for session', () => {
      const track = createTestCatalogTrack({ song_title: 'Hello', artist: 'Adele' });
      addImportedSongs(SESSION_ID, USER_A, [track]);
      markSongSung(SESSION_ID, 'Hello', 'Adele');

      clearPool(SESSION_ID);

      expect(getPool(SESSION_ID)).toBeUndefined();
      expect(getPooledSongs(SESSION_ID)).toEqual([]);
      expect(getSungSongKeys(SESSION_ID).size).toBe(0);
    });
  });

  describe('getPooledSongs', () => {
    it('returns empty array for nonexistent session', () => {
      expect(getPooledSongs('nonexistent')).toEqual([]);
    });

    it('returns correct array of songs', () => {
      const tracks = [
        createTestCatalogTrack({ song_title: 'Hello', artist: 'Adele', youtube_video_id: 'yt1', channel: 'Ch1', is_classic: true }),
        createTestCatalogTrack({ song_title: 'Bohemian Rhapsody', artist: 'Queen', youtube_video_id: 'yt2', channel: 'Ch2', is_classic: false }),
      ];
      addImportedSongs(SESSION_ID, USER_A, tracks);

      const songs = getPooledSongs(SESSION_ID);
      expect(songs).toHaveLength(2);

      const hello = songs.find(s => s.songTitle === 'Hello');
      expect(hello).toBeDefined();
      expect(hello!.catalogTrackId).toBe(tracks[0]!.id);
      expect(hello!.youtubeVideoId).toBe('yt1');
      expect(hello!.channel).toBe('Ch1');
      expect(hello!.isClassic).toBe(true);
      expect(hello!.overlapCount).toBe(1);
    });
  });

  describe('session isolation', () => {
    it('pools are independent across sessions', () => {
      const SESSION_2 = 's0000000-0000-0000-0000-000000000002';
      const track = createTestCatalogTrack({ song_title: 'Hello', artist: 'Adele' });

      addImportedSongs(SESSION_ID, USER_A, [track]);
      addImportedSongs(SESSION_2, USER_B, [track]);

      expect(getPooledSongs(SESSION_ID)).toHaveLength(1);
      expect(getPooledSongs(SESSION_2)).toHaveLength(1);

      // Overlap counts are independent
      expect(getPooledSongs(SESSION_ID)[0]!.overlapCount).toBe(1);
      expect(getPooledSongs(SESSION_2)[0]!.overlapCount).toBe(1);

      clearPool(SESSION_ID);
      expect(getPooledSongs(SESSION_ID)).toEqual([]);
      expect(getPooledSongs(SESSION_2)).toHaveLength(1);
    });
  });
});
