import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createTestCatalogTrack } from '../factories/catalog.js';

vi.mock('../../src/db/connection.js', () => ({
  db: {},
}));

vi.mock('../../src/persistence/catalog-repository.js', () => ({
  findClassics: vi.fn(),
}));

import * as catalogRepository from '../../src/persistence/catalog-repository.js';

import {
  addImportedSongs,
  markSongSung,
  resetAllPools,
} from '../../src/services/song-pool.js';

import {
  computeSuggestions,
  rankSong,
} from '../../src/services/suggestion-engine.js';

import type { PooledSong } from '../../src/services/song-pool.js';

const mockFindClassics = vi.mocked(catalogRepository.findClassics);

describe('suggestion-engine', () => {
  const SESSION_ID = 's0000000-0000-0000-0000-000000000001';
  const USER_A = 'u0000000-0000-0000-0000-00000000000a';
  const USER_B = 'u0000000-0000-0000-0000-00000000000b';
  const USER_C = 'u0000000-0000-0000-0000-00000000000c';

  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    resetAllPools();
  });

  describe('cold start', () => {
    it('returns classic songs when pool is empty', async () => {
      const classics = [
        createTestCatalogTrack({ song_title: 'Bohemian Rhapsody', artist: 'Queen', is_classic: true }),
        createTestCatalogTrack({ song_title: "Don't Stop Believin'", artist: 'Journey', is_classic: true }),
        createTestCatalogTrack({ song_title: 'Sweet Caroline', artist: 'Neil Diamond', is_classic: true }),
      ];
      mockFindClassics.mockResolvedValue(classics);

      const suggestions = await computeSuggestions(SESSION_ID, 3);

      expect(suggestions).toHaveLength(3);
      expect(mockFindClassics).toHaveBeenCalled();
      // Each suggestion has overlapCount=0 for cold start
      for (const s of suggestions) {
        expect(s.overlapCount).toBe(0);
      }
    });

    it('returns shuffled results (not always same order)', async () => {
      const classics = Array.from({ length: 20 }, (_, i) =>
        createTestCatalogTrack({ song_title: `Classic ${i}`, artist: `Artist ${i}`, is_classic: true }),
      );
      mockFindClassics.mockResolvedValue(classics);

      // Run multiple times to check shuffling
      const orders: string[] = [];
      for (let i = 0; i < 10; i++) {
        const suggestions = await computeSuggestions(SESSION_ID, 5);
        orders.push(suggestions.map(s => s.songTitle).join(','));
      }

      // At least some orderings should differ (extremely unlikely all 10 are same)
      const uniqueOrders = new Set(orders);
      expect(uniqueOrders.size).toBeGreaterThan(1);
    });

    it('returns empty array when no classics exist', async () => {
      mockFindClassics.mockResolvedValue([]);

      const suggestions = await computeSuggestions(SESSION_ID, 5);
      expect(suggestions).toEqual([]);
    });
  });

  describe('ranking', () => {
    it('songs ranked by overlap count (higher overlap = higher rank)', async () => {
      const track1 = createTestCatalogTrack({ song_title: 'Hello', artist: 'Adele' });
      const track2 = createTestCatalogTrack({ song_title: 'Bohemian Rhapsody', artist: 'Queen' });

      // Hello imported by 3 users, Bohemian by 1
      addImportedSongs(SESSION_ID, USER_A, [track1, track2]);
      addImportedSongs(SESSION_ID, USER_B, [track1]);
      addImportedSongs(SESSION_ID, USER_C, [track1]);

      const suggestions = await computeSuggestions(SESSION_ID, 2);

      // Hello (overlap=3) should rank higher than Bohemian (overlap=1)
      expect(suggestions[0]!.songTitle).toBe('Hello');
      expect(suggestions[0]!.overlapCount).toBe(3);
      expect(suggestions[1]!.songTitle).toBe('Bohemian Rhapsody');
      expect(suggestions[1]!.overlapCount).toBe(1);
    });

    it('sung songs deprioritized (lower score than unsung)', async () => {
      const track1 = createTestCatalogTrack({ song_title: 'Hello', artist: 'Adele' });
      const track2 = createTestCatalogTrack({ song_title: 'Bohemian Rhapsody', artist: 'Queen' });

      // Both with same overlap (1 user)
      addImportedSongs(SESSION_ID, USER_A, [track1, track2]);
      markSongSung(SESSION_ID, 'Hello', 'Adele');

      const suggestions = await computeSuggestions(SESSION_ID, 2);

      // Bohemian (unsung, bonus) should rank higher than Hello (sung, penalty)
      expect(suggestions[0]!.songTitle).toBe('Bohemian Rhapsody');
      expect(suggestions[1]!.songTitle).toBe('Hello');
    });

    it('mixed pool: overlap + not-yet-sung score highest', async () => {
      const trackA = createTestCatalogTrack({ song_title: 'Song A', artist: 'Artist A' });
      const trackB = createTestCatalogTrack({ song_title: 'Song B', artist: 'Artist B' });
      const trackC = createTestCatalogTrack({ song_title: 'Song C', artist: 'Artist C' });

      // Song A: overlap=2, not sung
      // Song B: overlap=1, not sung
      // Song C: overlap=2, sung
      addImportedSongs(SESSION_ID, USER_A, [trackA, trackB, trackC]);
      addImportedSongs(SESSION_ID, USER_B, [trackA, trackC]);
      markSongSung(SESSION_ID, 'Song C', 'Artist C');

      const suggestions = await computeSuggestions(SESSION_ID, 3);

      // Song A (overlap=2, unsung: 200+50=250 base) > Song B (overlap=1, unsung: 100+50=150 base) > Song C (overlap=2, sung: 200-200=0 base)
      expect(suggestions[0]!.songTitle).toBe('Song A');
      expect(suggestions[1]!.songTitle).toBe('Song B');
      expect(suggestions[2]!.songTitle).toBe('Song C');
    });
  });

  describe('count parameter', () => {
    it('returns exactly N suggestions', async () => {
      const tracks = Array.from({ length: 10 }, (_, i) =>
        createTestCatalogTrack({ song_title: `Song ${i}`, artist: `Artist ${i}` }),
      );
      addImportedSongs(SESSION_ID, USER_A, tracks);

      const suggestions = await computeSuggestions(SESSION_ID, 3);
      expect(suggestions).toHaveLength(3);
    });

    it('returns fewer if pool is smaller than count', async () => {
      const tracks = [
        createTestCatalogTrack({ song_title: 'Only Song', artist: 'Only Artist' }),
      ];
      addImportedSongs(SESSION_ID, USER_A, tracks);

      const suggestions = await computeSuggestions(SESSION_ID, 10);
      expect(suggestions).toHaveLength(1);
    });
  });

  describe('rankSong', () => {
    it('base score is overlapCount * 100', () => {
      const song: PooledSong = {
        catalogTrackId: 'id1',
        songTitle: 'Hello',
        artist: 'Adele',
        youtubeVideoId: 'yt1',
        channel: null,
        isClassic: false,
        overlapCount: 3,
        importedBy: new Set(['a', 'b', 'c']),
      };
      const sungKeys = new Set<string>();
      const score = rankSong(song, sungKeys);
      // 3*100 + 50 (not-yet-sung) + jitter(0-10)
      expect(score).toBeGreaterThanOrEqual(350);
      expect(score).toBeLessThan(360);
    });

    it('adds not-yet-sung bonus of 50', () => {
      const song: PooledSong = {
        catalogTrackId: 'id1',
        songTitle: 'Hello',
        artist: 'Adele',
        youtubeVideoId: 'yt1',
        channel: null,
        isClassic: false,
        overlapCount: 1,
        importedBy: new Set(['a']),
      };
      const sungKeys = new Set<string>();
      const score = rankSong(song, sungKeys);
      // 1*100 + 50 + jitter(0-10)
      expect(score).toBeGreaterThanOrEqual(150);
      expect(score).toBeLessThan(160);
    });

    it('subtracts 200 for already-sung songs', () => {
      const song: PooledSong = {
        catalogTrackId: 'id1',
        songTitle: 'Hello',
        artist: 'Adele',
        youtubeVideoId: 'yt1',
        channel: null,
        isClassic: false,
        overlapCount: 1,
        importedBy: new Set(['a']),
      };
      const sungKeys = new Set(['hello::adele']);
      const score = rankSong(song, sungKeys);
      // 1*100 - 200 + jitter(0-10)
      expect(score).toBeGreaterThanOrEqual(-100);
      expect(score).toBeLessThan(-90);
    });
  });
});
