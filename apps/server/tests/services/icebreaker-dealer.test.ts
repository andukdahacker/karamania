import { describe, it, expect, afterEach } from 'vitest';
import {
  dealQuestion,
  clearSession,
  resetAll,
  startIcebreakerRound,
  recordIcebreakerVote,
  resolveIcebreaker,
  ICEBREAKER_QUESTIONS,
} from '../../src/services/icebreaker-dealer.js';

describe('icebreaker-dealer service', () => {
  afterEach(() => {
    resetAll();
  });

  describe('ICEBREAKER_QUESTIONS pool', () => {
    it('has at least 12 questions', () => {
      expect(ICEBREAKER_QUESTIONS.length).toBeGreaterThanOrEqual(12);
    });

    it('all questions have required fields (id, question, options with id/label/emoji)', () => {
      for (const q of ICEBREAKER_QUESTIONS) {
        expect(q.id).toBeTruthy();
        expect(q.question).toBeTruthy();
        expect(q.options).toBeDefined();
        for (const opt of q.options) {
          expect(opt.id).toBeTruthy();
          expect(opt.label).toBeTruthy();
          expect(opt.emoji).toBeTruthy();
        }
      }
    });

    it('all questions have exactly 4 options', () => {
      for (const q of ICEBREAKER_QUESTIONS) {
        expect(q.options.length).toBe(4);
      }
    });

    it('all question IDs are unique', () => {
      const ids = ICEBREAKER_QUESTIONS.map(q => q.id);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('all option IDs within a question are unique', () => {
      for (const q of ICEBREAKER_QUESTIONS) {
        const optionIds = q.options.map(o => o.id);
        expect(new Set(optionIds).size).toBe(optionIds.length);
      }
    });
  });

  describe('dealQuestion', () => {
    it('returns a valid question from the pool', () => {
      const question = dealQuestion();
      const poolIds = ICEBREAKER_QUESTIONS.map(q => q.id);
      expect(poolIds).toContain(question.id);
      expect(question.question).toBeTruthy();
      expect(question.options.length).toBe(4);
    });
  });

  describe('startIcebreakerRound', () => {
    it('initializes an empty round', () => {
      startIcebreakerRound('session-1', 'fav-decade', ['80s', '90s', '2000s', '2010s']);
      // Verify round exists by recording a vote
      const result = recordIcebreakerVote('session-1', 'user-1', '80s');
      expect(result.recorded).toBe(true);
    });
  });

  describe('recordIcebreakerVote', () => {
    it('records a vote and returns firstVote: true on first vote', () => {
      startIcebreakerRound('session-1', 'fav-decade', ['80s', '90s', '2000s', '2010s']);
      const result = recordIcebreakerVote('session-1', 'user-1', '80s');
      expect(result.recorded).toBe(true);
      expect(result.firstVote).toBe(true);
    });

    it('returns firstVote: false on subsequent votes', () => {
      startIcebreakerRound('session-1', 'fav-decade', ['80s', '90s', '2000s', '2010s']);
      recordIcebreakerVote('session-1', 'user-1', '80s');
      const revote = recordIcebreakerVote('session-1', 'user-1', '90s');
      expect(revote.recorded).toBe(true);
      expect(revote.firstVote).toBe(false);
    });

    it('is idempotent — last vote wins', () => {
      startIcebreakerRound('session-1', 'fav-decade', ['80s', '90s', '2000s', '2010s']);
      recordIcebreakerVote('session-1', 'user-1', '80s');
      recordIcebreakerVote('session-1', 'user-1', '90s');
      const tally = resolveIcebreaker('session-1');
      expect(tally).not.toBeNull();
      expect(tally!.optionCounts['80s']).toBeUndefined();
      expect(tally!.optionCounts['90s']).toBe(1);
    });

    it('returns recorded: false for non-existent round', () => {
      const result = recordIcebreakerVote('session-1', 'user-1', '80s');
      expect(result.recorded).toBe(false);
      expect(result.firstVote).toBe(false);
    });

    it('returns recorded: false for resolved round', () => {
      startIcebreakerRound('session-1', 'fav-decade', ['80s', '90s', '2000s', '2010s']);
      recordIcebreakerVote('session-1', 'user-1', '80s');
      resolveIcebreaker('session-1');
      const result = recordIcebreakerVote('session-1', 'user-2', '90s');
      expect(result.recorded).toBe(false);
      expect(result.firstVote).toBe(false);
    });
  });

  describe('resolveIcebreaker', () => {
    it('tallies votes correctly', () => {
      startIcebreakerRound('session-1', 'fav-decade', ['80s', '90s', '2000s', '2010s']);
      recordIcebreakerVote('session-1', 'user-1', '80s');
      recordIcebreakerVote('session-1', 'user-2', '80s');
      recordIcebreakerVote('session-1', 'user-3', '90s');
      const tally = resolveIcebreaker('session-1');
      expect(tally).not.toBeNull();
      expect(tally!.optionCounts['80s']).toBe(2);
      expect(tally!.optionCounts['90s']).toBe(1);
      expect(tally!.totalVotes).toBe(3);
    });

    it('picks winner by highest count', () => {
      startIcebreakerRound('session-1', 'fav-decade', ['80s', '90s', '2000s', '2010s']);
      recordIcebreakerVote('session-1', 'user-1', '80s');
      recordIcebreakerVote('session-1', 'user-2', '80s');
      recordIcebreakerVote('session-1', 'user-3', '90s');
      const tally = resolveIcebreaker('session-1');
      expect(tally).not.toBeNull();
      expect(tally!.winnerOptionId).toBe('80s');
    });

    it('returns null if no round exists', () => {
      const result = resolveIcebreaker('session-1');
      expect(result).toBeNull();
    });

    it('marks round as resolved', () => {
      startIcebreakerRound('session-1', 'fav-decade', ['80s', '90s', '2000s', '2010s']);
      resolveIcebreaker('session-1');
      const result = recordIcebreakerVote('session-1', 'user-1', '80s');
      expect(result.recorded).toBe(false);
    });

    it('assigns random options to non-voters when participantIds provided', () => {
      startIcebreakerRound('session-1', 'fav-decade', ['80s', '90s', '2000s', '2010s']);
      recordIcebreakerVote('session-1', 'user-1', '80s');
      // user-2 and user-3 did NOT vote
      const tally = resolveIcebreaker('session-1', ['user-1', 'user-2', 'user-3']);
      expect(tally).not.toBeNull();
      expect(tally!.totalVotes).toBe(3); // all 3 participants counted
    });

    it('returns a valid option ID as winner when zero votes (not question ID)', () => {
      startIcebreakerRound('session-1', 'fav-decade', ['80s', '90s', '2000s', '2010s']);
      const tally = resolveIcebreaker('session-1');
      expect(tally).not.toBeNull();
      expect(['80s', '90s', '2000s', '2010s']).toContain(tally!.winnerOptionId);
    });
  });

  describe('clearSession', () => {
    it('removes round data for the session', () => {
      startIcebreakerRound('session-1', 'fav-decade', ['80s', '90s', '2000s', '2010s']);
      clearSession('session-1');
      // Round cleared — vote fails
      const result = recordIcebreakerVote('session-1', 'user-1', '80s');
      expect(result.recorded).toBe(false);
    });

    it('does not affect other sessions', () => {
      startIcebreakerRound('session-1', 'fav-decade', ['80s', '90s', '2000s', '2010s']);
      startIcebreakerRound('session-2', 'karaoke-style', ['shower', 'rockstar', 'backup', 'audience']);
      clearSession('session-1');
      // session-2 still active
      const result = recordIcebreakerVote('session-2', 'user-1', 'shower');
      expect(result.recorded).toBe(true);
    });
  });

  describe('resetAll', () => {
    it('clears all session data', () => {
      startIcebreakerRound('session-1', 'fav-decade', ['80s', '90s', '2000s', '2010s']);
      startIcebreakerRound('session-2', 'karaoke-style', ['shower', 'rockstar', 'backup', 'audience']);
      resetAll();
      // Both rounds cleared
      expect(recordIcebreakerVote('session-1', 'user-1', '80s').recorded).toBe(false);
      expect(recordIcebreakerVote('session-2', 'user-1', 'shower').recorded).toBe(false);
    });
  });
});
