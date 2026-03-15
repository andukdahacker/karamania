import { describe, it, expect, vi } from 'vitest';

vi.mock('../../src/config.js', () => ({
  config: {
    DATABASE_URL: 'postgresql://test:test@localhost:5432/test',
    JWT_SECRET: 'test-secret-key-at-least-32-characters-long',
    YOUTUBE_API_KEY: 'test-key',
    SPOTIFY_CLIENT_ID: 'test-id',
    SPOTIFY_CLIENT_SECRET: 'test-secret',
    FIREBASE_PROJECT_ID: 'test-project',
    FIREBASE_CLIENT_EMAIL: 'test@test.iam.gserviceaccount.com',
    FIREBASE_PRIVATE_KEY: 'test-key',
    NODE_ENV: 'test',
    PORT: 3000,
  },
}));

vi.mock('../../src/db/connection.js', () => ({
  db: {
    destroy: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../../src/persistence/catalog-repository.js', () => ({
  upsertBatch: vi.fn(),
}));

import { parseKaraokeTitle } from '../../scripts/scrape-catalog.js';

describe('parseKaraokeTitle', () => {
  it('parses "Artist - Song" format', () => {
    const result = parseKaraokeTitle('Queen - Bohemian Rhapsody');
    expect(result).toEqual({ artist: 'Queen', songTitle: 'Bohemian Rhapsody' });
  });

  it('parses "Artist - Song (Karaoke Version)"', () => {
    const result = parseKaraokeTitle('Queen - Bohemian Rhapsody (Karaoke Version)');
    expect(result).toEqual({ artist: 'Queen', songTitle: 'Bohemian Rhapsody' });
  });

  it('parses "Artist - Song (Karaoke)"', () => {
    const result = parseKaraokeTitle('Adele - Rolling in the Deep (Karaoke)');
    expect(result).toEqual({ artist: 'Adele', songTitle: 'Rolling in the Deep' });
  });

  it('parses "Artist - Song (Instrumental)"', () => {
    const result = parseKaraokeTitle('Bruno Mars - Uptown Funk (Instrumental)');
    expect(result).toEqual({ artist: 'Bruno Mars', songTitle: 'Uptown Funk' });
  });

  it('parses "Artist - Song (With Lyrics)"', () => {
    const result = parseKaraokeTitle('Ed Sheeran - Shape of You (With Lyrics)');
    expect(result).toEqual({ artist: 'Ed Sheeran', songTitle: 'Shape of You' });
  });

  it('parses "Artist - Song (Sing Along)"', () => {
    const result = parseKaraokeTitle('ABBA - Dancing Queen (Sing Along)');
    expect(result).toEqual({ artist: 'ABBA', songTitle: 'Dancing Queen' });
  });

  it('parses "Artist - Song | Karaoke Version"', () => {
    const result = parseKaraokeTitle('Taylor Swift - Shake It Off | Karaoke Version');
    expect(result).toEqual({ artist: 'Taylor Swift', songTitle: 'Shake It Off' });
  });

  it('parses "Artist - Song | Karaoke"', () => {
    const result = parseKaraokeTitle('Beyoncé - Crazy in Love | Karaoke');
    expect(result).toEqual({ artist: 'Beyoncé', songTitle: 'Crazy in Love' });
  });

  it('parses "Artist - Song - Karaoke Version"', () => {
    const result = parseKaraokeTitle('Rihanna - Umbrella - Karaoke Version');
    expect(result).toEqual({ artist: 'Rihanna', songTitle: 'Umbrella' });
  });

  it('parses title with multiple karaoke markers', () => {
    const result = parseKaraokeTitle('Lady Gaga - Poker Face (Karaoke) | Karaoke Version');
    expect(result).toEqual({ artist: 'Lady Gaga', songTitle: 'Poker Face' });
  });

  it('handles extra whitespace', () => {
    const result = parseKaraokeTitle('  Queen  -  Bohemian Rhapsody  ');
    expect(result).toEqual({ artist: 'Queen', songTitle: 'Bohemian Rhapsody' });
  });

  it('returns null for unparseable titles', () => {
    expect(parseKaraokeTitle('Just Some Random Text')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseKaraokeTitle('')).toBeNull();
  });

  it('returns null for title with only separators', () => {
    expect(parseKaraokeTitle(' - ')).toBeNull();
  });

  it('strips (Karaoke Version) case-insensitively', () => {
    const result = parseKaraokeTitle('Queen - We Will Rock You (KARAOKE VERSION)');
    expect(result).toEqual({ artist: 'Queen', songTitle: 'We Will Rock You' });
  });

  it('handles | Karaoke With Lyrics suffix', () => {
    const result = parseKaraokeTitle('Journey - Don\'t Stop Believin\' | Karaoke With Lyrics');
    expect(result).toEqual({ artist: 'Journey', songTitle: "Don't Stop Believin'" });
  });

  it('handles | Karaoke Instrumental suffix', () => {
    const result = parseKaraokeTitle('Bon Jovi - Livin\' on a Prayer | Karaoke Instrumental');
    expect(result).toEqual({ artist: 'Bon Jovi', songTitle: "Livin' on a Prayer" });
  });
});
