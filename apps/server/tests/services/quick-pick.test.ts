import { describe, it, expect, afterEach } from 'vitest';
import {
  startRound,
  recordVote,
  checkMajority,
  resolveByTimeout,
  getRound,
  clearRound,
  resetAllRounds,
} from '../../src/services/quick-pick.js';
import type { QuickPickSong } from '../../src/services/quick-pick.js';

function createTestSong(overrides?: Partial<QuickPickSong>): QuickPickSong {
  const id = overrides?.catalogTrackId ?? `cat-${Math.random().toString(36).slice(2, 8)}`;
  return {
    catalogTrackId: id,
    songTitle: overrides?.songTitle ?? `Song ${id}`,
    artist: overrides?.artist ?? `Artist ${id}`,
    youtubeVideoId: overrides?.youtubeVideoId ?? `yt_${id}`,
    overlapCount: overrides?.overlapCount ?? 1,
  };
}

function createTestSongs(count: number): QuickPickSong[] {
  return Array.from({ length: count }, (_, i) =>
    createTestSong({
      catalogTrackId: `song-${i + 1}`,
      songTitle: `Song ${i + 1}`,
      artist: `Artist ${i + 1}`,
      overlapCount: count - i, // descending overlap
    }),
  );
}

describe('quick-pick service', () => {
  afterEach(() => {
    resetAllRounds();
  });

  describe('startRound', () => {
    it('creates valid round with empty vote maps', () => {
      const songs = createTestSongs(5);
      const round = startRound('session-1', songs, 5);

      expect(round.sessionId).toBe('session-1');
      expect(round.songs).toHaveLength(5);
      expect(round.participantCount).toBe(5);
      expect(round.resolved).toBe(false);
      expect(round.winningSongId).toBeNull();
      expect(round.votes.size).toBe(5);

      // Each song has an empty vote map
      for (const song of songs) {
        const voteMap = round.votes.get(song.catalogTrackId);
        expect(voteMap).toBeDefined();
        expect(voteMap!.size).toBe(0);
      }
    });
  });

  describe('recordVote', () => {
    it('records vote correctly and returns tally', () => {
      const songs = createTestSongs(3);
      startRound('session-1', songs, 5);

      const result = recordVote('session-1', 'user-1', 'song-1', 'up');
      expect(result.recorded).toBe(true);
      expect(result.songVotes).toEqual({ up: 1, skip: 0 });
      expect(result.winner).toBeNull();
    });

    it('is idempotent — same user same song replaces vote', () => {
      const songs = createTestSongs(3);
      startRound('session-1', songs, 5);

      recordVote('session-1', 'user-1', 'song-1', 'up');
      const result = recordVote('session-1', 'user-1', 'song-1', 'up');
      expect(result.recorded).toBe(true);
      expect(result.songVotes).toEqual({ up: 1, skip: 0 });
    });

    it('allows changing vote from up to skip and vice versa', () => {
      const songs = createTestSongs(3);
      startRound('session-1', songs, 5);

      recordVote('session-1', 'user-1', 'song-1', 'up');
      expect(recordVote('session-1', 'user-1', 'song-1', 'skip').songVotes).toEqual({ up: 0, skip: 1 });
      expect(recordVote('session-1', 'user-1', 'song-1', 'up').songVotes).toEqual({ up: 1, skip: 0 });
    });

    it('returns not recorded for non-existent session', () => {
      const result = recordVote('nonexistent', 'user-1', 'song-1', 'up');
      expect(result.recorded).toBe(false);
    });

    it('returns not recorded for non-existent song', () => {
      startRound('session-1', createTestSongs(3), 5);
      const result = recordVote('session-1', 'user-1', 'bad-song', 'up');
      expect(result.recorded).toBe(false);
    });

    it('returns not recorded for resolved round', () => {
      const songs = createTestSongs(3);
      startRound('session-1', songs, 3);

      // Achieve majority (2 of 3)
      recordVote('session-1', 'user-1', 'song-1', 'up');
      recordVote('session-1', 'user-2', 'song-1', 'up');

      // Round is now resolved — further votes rejected
      const result = recordVote('session-1', 'user-3', 'song-2', 'up');
      expect(result.recorded).toBe(false);
    });
  });

  describe('checkMajority', () => {
    it('returns null when no majority', () => {
      const songs = createTestSongs(3);
      const round = startRound('session-1', songs, 5);

      recordVote('session-1', 'user-1', 'song-1', 'up');
      recordVote('session-1', 'user-2', 'song-2', 'up');

      // Reset resolved flag to test checkMajority independently
      round.resolved = false;
      const winner = checkMajority(round);
      expect(winner).toBeNull();
    });

    it('returns winner when >50% vote up (3 of 5 participants)', () => {
      const songs = createTestSongs(3);
      startRound('session-1', songs, 5);

      recordVote('session-1', 'user-1', 'song-1', 'up');
      recordVote('session-1', 'user-2', 'song-1', 'up');
      const result = recordVote('session-1', 'user-3', 'song-1', 'up');

      expect(result.winner).not.toBeNull();
      expect(result.winner!.catalogTrackId).toBe('song-1');
    });

    it('returns winner when >50% vote up (2 of 3 participants)', () => {
      const songs = createTestSongs(3);
      startRound('session-1', songs, 3);

      recordVote('session-1', 'user-1', 'song-2', 'up');
      const result = recordVote('session-1', 'user-2', 'song-2', 'up');

      expect(result.winner).not.toBeNull();
      expect(result.winner!.catalogTrackId).toBe('song-2');
    });

    it('tiebreaker: most up-votes wins, then array order', () => {
      const songs = createTestSongs(3);
      const round = startRound('session-1', songs, 10);

      // Give song-1 and song-2 both 6 up votes (>50% of 10)
      for (let i = 1; i <= 6; i++) {
        recordVote('session-1', `user-${i}`, 'song-1', 'up');
        round.resolved = false; // Reset to allow more votes
        round.winningSongId = null;
      }
      for (let i = 7; i <= 12; i++) {
        recordVote('session-1', `user-${i}`, 'song-2', 'up');
        round.resolved = false;
        round.winningSongId = null;
      }

      // song-2 now has 6 votes, song-1 has 6 votes — both >= threshold
      // song-1 is first in array, but song-2 has same count
      // Both have 6, so first in array order (song-1) should win
      const winner = checkMajority(round);
      expect(winner).not.toBeNull();
      // song-1 comes first in array and has same up-votes, so it wins
      expect(winner!.catalogTrackId).toBe('song-1');
    });
  });

  describe('resolveByTimeout', () => {
    it('picks highest-voted song', () => {
      const songs = createTestSongs(3);
      startRound('session-1', songs, 5);

      recordVote('session-1', 'user-1', 'song-2', 'up');
      recordVote('session-1', 'user-2', 'song-2', 'up');
      recordVote('session-1', 'user-3', 'song-1', 'up');

      const winner = resolveByTimeout('session-1');
      expect(winner).not.toBeNull();
      expect(winner!.catalogTrackId).toBe('song-2');
    });

    it('tiebreaker: higher overlapCount, then array order', () => {
      const songs = [
        createTestSong({ catalogTrackId: 'song-a', overlapCount: 2 }),
        createTestSong({ catalogTrackId: 'song-b', overlapCount: 5 }),
      ];
      startRound('session-1', songs, 5);

      // Same number of up-votes for both
      recordVote('session-1', 'user-1', 'song-a', 'up');
      recordVote('session-1', 'user-2', 'song-b', 'up');

      const winner = resolveByTimeout('session-1');
      expect(winner).not.toBeNull();
      expect(winner!.catalogTrackId).toBe('song-b'); // higher overlapCount
    });

    it('with zero votes returns first song', () => {
      const songs = createTestSongs(3);
      startRound('session-1', songs, 5);

      const winner = resolveByTimeout('session-1');
      expect(winner).not.toBeNull();
      expect(winner!.catalogTrackId).toBe('song-1');
    });

    it('marks round as resolved', () => {
      startRound('session-1', createTestSongs(3), 5);

      resolveByTimeout('session-1');

      const round = getRound('session-1');
      expect(round!.resolved).toBe(true);
    });

    it('returns null for already resolved round', () => {
      startRound('session-1', createTestSongs(3), 5);
      resolveByTimeout('session-1');

      const result = resolveByTimeout('session-1');
      expect(result).toBeNull();
    });

    it('returns null for non-existent session', () => {
      const result = resolveByTimeout('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('clearRound', () => {
    it('removes session data', () => {
      startRound('session-1', createTestSongs(3), 5);
      expect(getRound('session-1')).toBeDefined();

      clearRound('session-1');
      expect(getRound('session-1')).toBeUndefined();
    });
  });

  describe('module isolation', () => {
    it('different sessions do not interfere', () => {
      startRound('session-1', createTestSongs(3), 5);
      startRound('session-2', createTestSongs(3), 5);

      recordVote('session-1', 'user-1', 'song-1', 'up');

      const round2 = getRound('session-2');
      const song1Votes = round2!.votes.get('song-1');
      expect(song1Votes!.size).toBe(0);
    });
  });

  describe('resetAllRounds', () => {
    it('clears all data', () => {
      startRound('session-1', createTestSongs(3), 5);
      startRound('session-2', createTestSongs(3), 5);

      resetAllRounds();

      expect(getRound('session-1')).toBeUndefined();
      expect(getRound('session-2')).toBeUndefined();
    });
  });
});
