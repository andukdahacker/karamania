import { describe, it, expect, afterEach } from 'vitest';
import {
  dealQuestion,
  clearSession,
  resetAll,
  startQuickVoteRound,
  recordQuickVote,
  resolveQuickVote,
  QUICK_VOTE_QUESTIONS,
} from '../../src/services/quick-vote-dealer.js';

describe('quick-vote-dealer service', () => {
  afterEach(() => {
    resetAll();
  });

  describe('QUICK_VOTE_QUESTIONS pool', () => {
    it('has at least 20 questions', () => {
      expect(QUICK_VOTE_QUESTIONS.length).toBeGreaterThanOrEqual(20);
    });

    it('all questions have non-empty id, question, optionA, optionB, emoji', () => {
      for (const q of QUICK_VOTE_QUESTIONS) {
        expect(q.id).toBeTruthy();
        expect(q.question).toBeTruthy();
        expect(q.optionA).toBeTruthy();
        expect(q.optionB).toBeTruthy();
        expect(q.emoji).toBeTruthy();
      }
    });

    it('all question ids are unique', () => {
      const ids = QUICK_VOTE_QUESTIONS.map(q => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('dealQuestion', () => {
    it('returns a valid question from the pool', () => {
      const question = dealQuestion('session-1');
      const poolIds = QUICK_VOTE_QUESTIONS.map(q => q.id);
      expect(poolIds).toContain(question.id);
      expect(question.question).toBeTruthy();
      expect(question.optionA).toBeTruthy();
      expect(question.optionB).toBeTruthy();
      expect(question.emoji).toBeTruthy();
    });

    it('does not deal the same question twice in a row for the same session', () => {
      const first = dealQuestion('session-1');
      const second = dealQuestion('session-1');
      expect(second.id).not.toBe(first.id);
    });

    it('can deal questions to different sessions independently', () => {
      const q1 = dealQuestion('session-1');
      const q2 = dealQuestion('session-2');
      expect(q1.id).toBeTruthy();
      expect(q2.id).toBeTruthy();
    });
  });

  describe('startQuickVoteRound', () => {
    it('initializes an empty round', () => {
      startQuickVoteRound('session-1', 'q-1');
      // Verify round exists by recording a vote
      const result = recordQuickVote('session-1', 'user-1', 'A');
      expect(result.recorded).toBe(true);
    });
  });

  describe('recordQuickVote', () => {
    it('records a vote successfully', () => {
      startQuickVoteRound('session-1', 'q-1');
      const result = recordQuickVote('session-1', 'user-1', 'A');
      expect(result.recorded).toBe(true);
      expect(result.firstVote).toBe(true);
    });

    it('is idempotent — last vote wins', () => {
      startQuickVoteRound('session-1', 'q-1');
      recordQuickVote('session-1', 'user-1', 'A');
      const revote = recordQuickVote('session-1', 'user-1', 'B');
      expect(revote.recorded).toBe(true);
      expect(revote.firstVote).toBe(false);
      const tally = resolveQuickVote('session-1');
      expect(tally).not.toBeNull();
      expect(tally!.optionACounts).toBe(0);
      expect(tally!.optionBCounts).toBe(1);
    });

    it('returns false for non-existent round', () => {
      const result = recordQuickVote('session-1', 'user-1', 'A');
      expect(result.recorded).toBe(false);
      expect(result.firstVote).toBe(false);
    });

    it('returns false for resolved round', () => {
      startQuickVoteRound('session-1', 'q-1');
      recordQuickVote('session-1', 'user-1', 'A');
      resolveQuickVote('session-1');
      const result = recordQuickVote('session-1', 'user-2', 'B');
      expect(result.recorded).toBe(false);
      expect(result.firstVote).toBe(false);
    });
  });

  describe('resolveQuickVote', () => {
    it('tallies votes correctly', () => {
      startQuickVoteRound('session-1', 'q-1');
      recordQuickVote('session-1', 'user-1', 'A');
      recordQuickVote('session-1', 'user-2', 'A');
      recordQuickVote('session-1', 'user-3', 'B');
      const tally = resolveQuickVote('session-1');
      expect(tally).toEqual({ optionACounts: 2, optionBCounts: 1, totalVotes: 3 });
    });

    it('returns null for non-existent round', () => {
      const result = resolveQuickVote('session-1');
      expect(result).toBeNull();
    });

    it('marks round as resolved', () => {
      startQuickVoteRound('session-1', 'q-1');
      resolveQuickVote('session-1');
      // Subsequent vote should fail
      const result = recordQuickVote('session-1', 'user-1', 'A');
      expect(result.recorded).toBe(false);
    });

    it('returns zero counts when no votes cast', () => {
      startQuickVoteRound('session-1', 'q-1');
      const tally = resolveQuickVote('session-1');
      expect(tally).toEqual({ optionACounts: 0, optionBCounts: 0, totalVotes: 0 });
    });
  });

  describe('clearSession', () => {
    it('resets question tracking and active round for session', () => {
      dealQuestion('session-1');
      startQuickVoteRound('session-1', 'q-1');
      clearSession('session-1');
      // Question tracking cleared — dealQuestion works
      const q = dealQuestion('session-1');
      expect(q.id).toBeTruthy();
      // Round cleared — vote fails
      const result = recordQuickVote('session-1', 'user-1', 'A');
      expect(result.recorded).toBe(false);
    });

    it('does not affect other sessions', () => {
      startQuickVoteRound('session-1', 'q-1');
      startQuickVoteRound('session-2', 'q-2');
      clearSession('session-1');
      // session-2 still active
      const result = recordQuickVote('session-2', 'user-1', 'A');
      expect(result.recorded).toBe(true);
    });
  });

  describe('resetAll', () => {
    it('clears all session data', () => {
      dealQuestion('session-1');
      dealQuestion('session-2');
      startQuickVoteRound('session-1', 'q-1');
      startQuickVoteRound('session-2', 'q-2');
      resetAll();
      // Both sessions cleared
      const q1 = dealQuestion('session-1');
      const q2 = dealQuestion('session-2');
      expect(q1.id).toBeTruthy();
      expect(q2.id).toBeTruthy();
      // Rounds cleared
      expect(recordQuickVote('session-1', 'user-1', 'A').recorded).toBe(false);
      expect(recordQuickVote('session-2', 'user-1', 'A').recorded).toBe(false);
    });
  });
});
