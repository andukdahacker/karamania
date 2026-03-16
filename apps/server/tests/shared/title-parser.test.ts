import { describe, it, expect } from 'vitest';
import { parseKaraokeTitle } from '../../src/shared/title-parser.js';

describe('parseKaraokeTitle (direct import from shared/title-parser)', () => {
  it('parses "Artist - Song" format', () => {
    expect(parseKaraokeTitle('Queen - Bohemian Rhapsody')).toEqual({
      artist: 'Queen',
      songTitle: 'Bohemian Rhapsody',
    });
  });

  it('handles hyphenated artist names (Jay-Z)', () => {
    expect(parseKaraokeTitle('Jay-Z - 99 Problems')).toEqual({
      artist: 'Jay-Z',
      songTitle: '99 Problems',
    });
  });

  it('handles hyphenated artist names (Blink-182)', () => {
    expect(parseKaraokeTitle('Blink-182 - All The Small Things')).toEqual({
      artist: 'Blink-182',
      songTitle: 'All The Small Things',
    });
  });

  it('handles hyphenated artist names (Run-DMC)', () => {
    expect(parseKaraokeTitle('Run-DMC - It\'s Like That')).toEqual({
      artist: 'Run-DMC',
      songTitle: "It's Like That",
    });
  });

  it('strips karaoke suffixes before parsing', () => {
    expect(parseKaraokeTitle('Adele - Hello (Karaoke Version)')).toEqual({
      artist: 'Adele',
      songTitle: 'Hello',
    });
  });

  it('returns null for title without space-dash-space separator', () => {
    expect(parseKaraokeTitle('NoDashHere')).toBeNull();
  });

  it('returns null for compact dash without spaces', () => {
    expect(parseKaraokeTitle('Artist-Song')).toBeNull();
  });

  it('returns null for empty string', () => {
    expect(parseKaraokeTitle('')).toBeNull();
  });
});
