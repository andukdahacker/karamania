import { describe, it, expect } from 'vitest';
import {
  normalizeSongTitle,
  normalizeArtist,
  generateSongKey,
  songsMatch,
} from '../../src/shared/song-normalizer.js';

describe('song-normalizer', () => {
  describe('normalizeSongTitle', () => {
    it('lowercases and trims whitespace', () => {
      expect(normalizeSongTitle('  Hello  ')).toBe('hello');
    });

    it('collapses multiple spaces', () => {
      expect(normalizeSongTitle('Rolling   In   The   Deep')).toBe('rolling in the deep');
    });

    it('strips (karaoke) suffix', () => {
      expect(normalizeSongTitle('Hello (Karaoke)')).toBe('hello');
    });

    it('strips (karaoke version) suffix case-insensitive', () => {
      expect(normalizeSongTitle('Hello (KARAOKE VERSION)')).toBe('hello');
    });

    it('strips (instrumental) suffix', () => {
      expect(normalizeSongTitle('Hello (Instrumental)')).toBe('hello');
    });

    it('strips (with lyrics) suffix', () => {
      expect(normalizeSongTitle('Hello (With Lyrics)')).toBe('hello');
    });

    it('strips (official video) suffix', () => {
      expect(normalizeSongTitle('Hello (Official Video)')).toBe('hello');
    });

    it('strips (official music video) suffix', () => {
      expect(normalizeSongTitle('Hello (Official Music Video)')).toBe('hello');
    });

    it('strips (lyric video) suffix', () => {
      expect(normalizeSongTitle('Hello (Lyric Video)')).toBe('hello');
    });

    it('strips (audio) suffix', () => {
      expect(normalizeSongTitle('Hello (Audio)')).toBe('hello');
    });

    it('strips (remix) suffix', () => {
      expect(normalizeSongTitle('Hello (Remix)')).toBe('hello');
    });

    it('strips feat./ft./featuring from title', () => {
      expect(normalizeSongTitle('Closer feat. Halsey')).toBe('closer');
      expect(normalizeSongTitle('Closer ft. Halsey')).toBe('closer');
      expect(normalizeSongTitle('Closer featuring Halsey')).toBe('closer');
    });

    it('strips trailing punctuation', () => {
      expect(normalizeSongTitle('Hello!')).toBe('hello');
      expect(normalizeSongTitle('Hello...')).toBe('hello');
    });

    it('handles multiple suffixes', () => {
      expect(normalizeSongTitle('Hello (Karaoke Version) (With Lyrics)')).toBe('hello');
    });
  });

  describe('normalizeArtist', () => {
    it('lowercases and trims', () => {
      expect(normalizeArtist('  Adele  ')).toBe('adele');
    });

    it('collapses multiple spaces', () => {
      expect(normalizeArtist('The   Weeknd')).toBe('the weeknd');
    });

    it('strips feat./ft./featuring suffixes', () => {
      expect(normalizeArtist('The Chainsmokers feat. Halsey')).toBe('the chainsmokers');
      expect(normalizeArtist('The Chainsmokers ft. Halsey')).toBe('the chainsmokers');
      expect(normalizeArtist('The Chainsmokers featuring Halsey')).toBe('the chainsmokers');
    });

    it('extracts primary artist from "A & B" format', () => {
      expect(normalizeArtist('Drake & Future')).toBe('drake');
    });

    it('extracts primary artist from "A, B" format', () => {
      expect(normalizeArtist('Drake, Future')).toBe('drake');
    });

    it('extracts primary artist from "A, B & C" format', () => {
      expect(normalizeArtist('Drake, Future & Metro Boomin')).toBe('drake');
    });
  });

  describe('generateSongKey', () => {
    it('generates deterministic key from title and artist', () => {
      expect(generateSongKey('Rolling In The Deep', 'Adele')).toBe('rolling in the deep::adele');
    });

    it('same song from YouTube and Spotify produces same key', () => {
      // YouTube: parsed by title-parser, still has suffix
      const youtubeKey = generateSongKey('Rolling In The Deep (Karaoke Version)', 'Adele');
      // Spotify: structured data, clean
      const spotifyKey = generateSongKey('Rolling in the Deep', 'Adele');
      expect(youtubeKey).toBe(spotifyKey);
    });

    it('normalizes both title and artist', () => {
      const key = generateSongKey('  Hello (Official Video)  ', '  Adele  ');
      expect(key).toBe('hello::adele');
    });
  });

  describe('songsMatch', () => {
    it('returns true for same song with different formatting', () => {
      expect(songsMatch(
        { title: 'Rolling In The Deep (Karaoke Version)', artist: 'Adele' },
        { title: 'Rolling in the Deep', artist: 'ADELE' },
      )).toBe(true);
    });

    it('returns false for different songs', () => {
      expect(songsMatch(
        { title: 'Hello', artist: 'Adele' },
        { title: 'Rolling In The Deep', artist: 'Adele' },
      )).toBe(false);
    });

    it('returns false for same title different artist', () => {
      expect(songsMatch(
        { title: 'Hello', artist: 'Adele' },
        { title: 'Hello', artist: 'Lionel Richie' },
      )).toBe(false);
    });
  });

  describe('cross-platform matching', () => {
    it('YouTube title "Artist - Song (Karaoke Version)" matches Spotify structured data', () => {
      // YouTube: after parseKaraokeTitle(), title still has suffix, artist is clean
      const youtubeKey = generateSongKey('Bohemian Rhapsody (Karaoke Version)', 'Queen');
      // Spotify: structured { name: "Bohemian Rhapsody", artists: [{ name: "Queen" }] }
      const spotifyKey = generateSongKey('Bohemian Rhapsody', 'Queen');
      expect(youtubeKey).toBe(spotifyKey);
    });

    it('handles feat. artist differences across platforms', () => {
      // YouTube: "Closer feat. Halsey" by "The Chainsmokers"
      const youtubeKey = generateSongKey('Closer feat. Halsey', 'The Chainsmokers');
      // Spotify: "Closer" by "The Chainsmokers, Halsey"
      const spotifyKey = generateSongKey('Closer', 'The Chainsmokers, Halsey');
      expect(youtubeKey).toBe(spotifyKey);
    });
  });
});
