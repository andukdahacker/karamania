import { describe, it, expect, afterEach } from 'vitest';
import {
  selectActivityOptions,
  startVoteRound,
  recordVote,
  checkMajority,
  resolveByTimeout,
  getRound,
  getVoteCounts,
  clearSession,
  resetAllRounds,
  ACTIVITY_POOL,
} from '../../src/services/activity-voter.js';
import type { ActivityOption } from '../../src/services/activity-voter.js';

describe('activity-voter service', () => {
  afterEach(() => {
    resetAllRounds();
  });

  describe('selectActivityOptions', () => {
    const now = Date.now();

    it('returns 2-3 options', () => {
      const options = selectActivityOptions('session-1', 5, now - 60 * 60 * 1000);
      expect(options.length).toBeGreaterThanOrEqual(2);
      expect(options.length).toBeLessThanOrEqual(3);
    });

    it('filters by minParticipants', () => {
      // With 2 participants, kings_cup (min 3) and dare_pull (min 3) are excluded
      const options = selectActivityOptions('session-1', 2, now - 60 * 60 * 1000);
      for (const option of options) {
        expect(option.minParticipants).toBeLessThanOrEqual(2);
      }
    });

    it('excludes dare_pull in first 30 minutes (front-loading universal)', () => {
      // Session started 10 minutes ago — early session
      const results: ActivityOption[][] = [];
      for (let i = 0; i < 50; i++) {
        results.push(selectActivityOptions(`session-${i}`, 5, now - 10 * 60 * 1000));
      }
      const allOptions = results.flat();
      const hasDarePull = allOptions.some(o => o.id === 'dare_pull');
      expect(hasDarePull).toBe(false);
    });

    it('allows dare_pull after 30 minutes', () => {
      // Session started 45 minutes ago — dare_pull should be eligible
      const results: ActivityOption[][] = [];
      for (let i = 0; i < 100; i++) {
        results.push(selectActivityOptions(`session-${i}`, 5, now - 45 * 60 * 1000));
      }
      const allOptions = results.flat();
      const hasDarePull = allOptions.some(o => o.id === 'dare_pull');
      expect(hasDarePull).toBe(true);
    });

    it('excludes last selected activity (no immediate repeat)', () => {
      // Start a round, resolve it, then check next selection excludes winner
      const options = [ACTIVITY_POOL[0]!, ACTIVITY_POOL[2]!]; // kings_cup, quick_vote
      startVoteRound('session-1', options, 5);
      recordVote('session-1', 'user-1', options[0]!.id);
      recordVote('session-1', 'user-2', options[0]!.id);
      recordVote('session-1', 'user-3', options[0]!.id);

      // kings_cup won — should be excluded from next selection
      const results: ActivityOption[][] = [];
      for (let i = 0; i < 50; i++) {
        results.push(selectActivityOptions('session-1', 5, now - 60 * 60 * 1000));
      }
      // kings_cup should not appear in any selection since it was last selected
      const allOptions = results.flat();
      const hasLastWinner = allOptions.some(o => o.id === 'kings_cup');
      expect(hasLastWinner).toBe(false);
    });

    it('returns all eligible when pool is small', () => {
      // With 2 participants and early session: only quick_vote and group_singalong eligible
      const options = selectActivityOptions('session-1', 2, now - 10 * 60 * 1000);
      expect(options.length).toBe(2);
      const ids = options.map(o => o.id).sort();
      expect(ids).toEqual(['group_singalong', 'quick_vote']);
    });
  });

  describe('startVoteRound', () => {
    it('creates valid round with empty votes', () => {
      const options = ACTIVITY_POOL.slice(0, 3);
      const round = startVoteRound('session-1', options, 5);

      expect(round.sessionId).toBe('session-1');
      expect(round.options).toHaveLength(3);
      expect(round.participantCount).toBe(5);
      expect(round.resolved).toBe(false);
      expect(round.winningOptionId).toBeNull();
      expect(round.votes.size).toBe(0);
    });

    it('stores interludeCount in round metadata', () => {
      const options = ACTIVITY_POOL.slice(0, 2);
      const round = startVoteRound('session-1', options, 5, 3);
      expect(round.interludeCount).toBe(3);
    });
  });

  describe('recordVote', () => {
    it('records vote and returns tally', () => {
      const options = ACTIVITY_POOL.slice(0, 3);
      startVoteRound('session-1', options, 5);

      const result = recordVote('session-1', 'user-1', options[0]!.id);
      expect(result.recorded).toBe(true);
      expect(result.voteCounts[options[0]!.id]).toBe(1);
      expect(result.voteCounts[options[1]!.id]).toBe(0);
      expect(result.winner).toBeNull();
    });

    it('is idempotent — same user re-voting for same option', () => {
      const options = ACTIVITY_POOL.slice(0, 3);
      startVoteRound('session-1', options, 5);

      recordVote('session-1', 'user-1', options[0]!.id);
      const result = recordVote('session-1', 'user-1', options[0]!.id);
      expect(result.recorded).toBe(true);
      expect(result.voteCounts[options[0]!.id]).toBe(1); // still 1, not 2
    });

    it('allows changing vote (last vote wins)', () => {
      const options = ACTIVITY_POOL.slice(0, 3);
      startVoteRound('session-1', options, 5);

      recordVote('session-1', 'user-1', options[0]!.id);
      const result = recordVote('session-1', 'user-1', options[1]!.id);
      expect(result.voteCounts[options[0]!.id]).toBe(0);
      expect(result.voteCounts[options[1]!.id]).toBe(1);
    });

    it('returns not recorded for non-existent session', () => {
      const result = recordVote('nonexistent', 'user-1', 'kings_cup');
      expect(result.recorded).toBe(false);
    });

    it('returns not recorded for invalid optionId', () => {
      startVoteRound('session-1', ACTIVITY_POOL.slice(0, 2), 5);
      const result = recordVote('session-1', 'user-1', 'bad-option');
      expect(result.recorded).toBe(false);
    });

    it('returns not recorded for resolved round', () => {
      const options = ACTIVITY_POOL.slice(0, 2);
      startVoteRound('session-1', options, 3);

      // Achieve majority (2 of 3)
      recordVote('session-1', 'user-1', options[0]!.id);
      recordVote('session-1', 'user-2', options[0]!.id);

      // Round is now resolved
      const result = recordVote('session-1', 'user-3', options[1]!.id);
      expect(result.recorded).toBe(false);
    });
  });

  describe('checkMajority', () => {
    it('returns null when no majority', () => {
      const options = ACTIVITY_POOL.slice(0, 3);
      const round = startVoteRound('session-1', options, 5);

      recordVote('session-1', 'user-1', options[0]!.id);
      recordVote('session-1', 'user-2', options[1]!.id);

      round.resolved = false;
      const winner = checkMajority(round);
      expect(winner).toBeNull();
    });

    it('returns winner when majority reached (3 of 5)', () => {
      const options = ACTIVITY_POOL.slice(0, 3);
      startVoteRound('session-1', options, 5);

      recordVote('session-1', 'user-1', options[0]!.id);
      recordVote('session-1', 'user-2', options[0]!.id);
      const result = recordVote('session-1', 'user-3', options[0]!.id);

      expect(result.winner).not.toBeNull();
      expect(result.winner!.id).toBe(options[0]!.id);
    });

    it('returns winner when majority reached (2 of 3)', () => {
      const options = ACTIVITY_POOL.slice(0, 2);
      startVoteRound('session-1', options, 3);

      recordVote('session-1', 'user-1', options[0]!.id);
      const result = recordVote('session-1', 'user-2', options[0]!.id);

      expect(result.winner).not.toBeNull();
      expect(result.winner!.id).toBe(options[0]!.id);
    });

    it('updates lastSelectedActivity on majority win', () => {
      const options = ACTIVITY_POOL.slice(0, 2);
      startVoteRound('session-1', options, 3);

      recordVote('session-1', 'user-1', options[0]!.id);
      recordVote('session-1', 'user-2', options[0]!.id);

      const round = getRound('session-1');
      expect(round!.resolved).toBe(true);
      expect(round!.winningOptionId).toBe(options[0]!.id);
    });
  });

  describe('resolveByTimeout', () => {
    it('picks highest-voted option', () => {
      const options = ACTIVITY_POOL.slice(0, 3);
      startVoteRound('session-1', options, 5);

      recordVote('session-1', 'user-1', options[1]!.id);
      recordVote('session-1', 'user-2', options[1]!.id);
      recordVote('session-1', 'user-3', options[0]!.id);

      const winner = resolveByTimeout('session-1');
      expect(winner).not.toBeNull();
      expect(winner!.id).toBe(options[1]!.id);
    });

    it('tiebreaker: random selection among tied options', () => {
      const options = ACTIVITY_POOL.slice(0, 2);
      startVoteRound('session-1', options, 4);

      recordVote('session-1', 'user-1', options[0]!.id);
      recordVote('session-1', 'user-2', options[1]!.id);

      // Both have 1 vote — random tiebreaker
      const winner = resolveByTimeout('session-1');
      expect(winner).not.toBeNull();
      expect([options[0]!.id, options[1]!.id]).toContain(winner!.id);
    });

    it('with zero votes picks random option', () => {
      const options = ACTIVITY_POOL.slice(0, 3);
      startVoteRound('session-1', options, 5);

      const winner = resolveByTimeout('session-1');
      expect(winner).not.toBeNull();
      const optionIds = options.map(o => o.id);
      expect(optionIds).toContain(winner!.id);
    });

    it('marks round as resolved', () => {
      startVoteRound('session-1', ACTIVITY_POOL.slice(0, 2), 5);
      resolveByTimeout('session-1');

      const round = getRound('session-1');
      expect(round!.resolved).toBe(true);
    });

    it('returns null for already resolved round', () => {
      startVoteRound('session-1', ACTIVITY_POOL.slice(0, 2), 5);
      resolveByTimeout('session-1');

      const result = resolveByTimeout('session-1');
      expect(result).toBeNull();
    });

    it('returns null for non-existent session', () => {
      const result = resolveByTimeout('nonexistent');
      expect(result).toBeNull();
    });

    it('updates lastSelectedActivity on timeout resolve', () => {
      const options = ACTIVITY_POOL.slice(0, 2);
      startVoteRound('session-1', options, 5);

      recordVote('session-1', 'user-1', options[0]!.id);
      const winner = resolveByTimeout('session-1');

      // Next selection should exclude the winner
      expect(winner).not.toBeNull();
    });
  });

  describe('clearSession', () => {
    it('removes round and lastSelectedActivity', () => {
      const options = ACTIVITY_POOL.slice(0, 2);
      startVoteRound('session-1', options, 3);
      recordVote('session-1', 'user-1', options[0]!.id);
      recordVote('session-1', 'user-2', options[0]!.id); // majority → sets lastSelected

      expect(getRound('session-1')).toBeDefined();

      clearSession('session-1');
      expect(getRound('session-1')).toBeUndefined();

      // After clearSession, previously excluded activity should be eligible again
      const now = Date.now();
      const results: ActivityOption[][] = [];
      for (let i = 0; i < 50; i++) {
        results.push(selectActivityOptions('session-1', 5, now - 60 * 60 * 1000));
      }
      const allIds = results.flat().map(o => o.id);
      expect(allIds).toContain(options[0]!.id);
    });
  });

  describe('module isolation', () => {
    it('different sessions do not interfere', () => {
      const options = ACTIVITY_POOL.slice(0, 2);
      startVoteRound('session-1', options, 5);
      startVoteRound('session-2', options, 5);

      recordVote('session-1', 'user-1', options[0]!.id);

      const counts2 = getVoteCounts('session-2');
      expect(counts2[options[0]!.id]).toBe(0);
    });
  });

  describe('resetAllRounds', () => {
    it('clears all data', () => {
      startVoteRound('session-1', ACTIVITY_POOL.slice(0, 2), 5);
      startVoteRound('session-2', ACTIVITY_POOL.slice(0, 2), 5);

      resetAllRounds();

      expect(getRound('session-1')).toBeUndefined();
      expect(getRound('session-2')).toBeUndefined();
    });
  });
});
