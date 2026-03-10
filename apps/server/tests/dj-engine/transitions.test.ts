import { describe, it, expect } from 'vitest';
import { transition } from '../../src/dj-engine/transitions.js';
import { DJState, DJEngineError } from '../../src/dj-engine/types.js';
import type { DJTransition } from '../../src/dj-engine/types.js';
import { createTestDJContext, createTestDJContextInState } from '../factories/dj-state.js';

const NOW = 1_000_000;

describe('transition', () => {
  describe('SESSION_STARTED', () => {
    it('transitions from lobby to songSelection', () => {
      const ctx = createTestDJContext();
      const result = transition(ctx, { type: 'SESSION_STARTED' }, NOW);
      expect(result.state).toBe(DJState.songSelection);
    });

    it('sets sessionStartedAt to provided now value', () => {
      const ctx = createTestDJContext();
      const result = transition(ctx, { type: 'SESSION_STARTED' }, NOW);
      expect(result.sessionStartedAt).toBe(NOW);
    });

    it('requires at least 1 participant', () => {
      const ctx = createTestDJContext({ participantCount: 0 });
      expect(() => transition(ctx, { type: 'SESSION_STARTED' }, NOW)).toThrow(DJEngineError);
      expect(() => transition(ctx, { type: 'SESSION_STARTED' }, NOW)).toThrow('Cannot start session with zero participants');
    });

    it('rejects from non-lobby state', () => {
      const ctx = createTestDJContextInState(DJState.songSelection);
      expect(() => transition(ctx, { type: 'SESSION_STARTED' }, NOW)).toThrow(DJEngineError);
    });
  });

  describe('SONG_SELECTED', () => {
    it('transitions from songSelection to partyCardDeal (normal)', () => {
      const ctx = createTestDJContextInState(DJState.songSelection);
      const result = transition(ctx, { type: 'SONG_SELECTED' }, NOW);
      expect(result.state).toBe(DJState.partyCardDeal);
    });

    it('skips partyCardDeal with low participants (NFR12)', () => {
      const ctx = createTestDJContextInState(DJState.songSelection, { participantCount: 2 });
      const result = transition(ctx, { type: 'SONG_SELECTED' }, NOW);
      expect(result.state).toBe(DJState.song);
    });

    it('rejects from wrong state', () => {
      const ctx = createTestDJContextInState(DJState.song);
      expect(() => transition(ctx, { type: 'SONG_SELECTED' }, NOW)).toThrow(DJEngineError);
    });
  });

  describe('CARD_DEALT', () => {
    it('transitions from partyCardDeal to song', () => {
      const ctx = createTestDJContextInState(DJState.partyCardDeal);
      const result = transition(ctx, { type: 'CARD_DEALT' }, NOW);
      expect(result.state).toBe(DJState.song);
    });
  });

  describe('CARD_DONE', () => {
    it('transitions from partyCardDeal to song', () => {
      const ctx = createTestDJContextInState(DJState.partyCardDeal);
      const result = transition(ctx, { type: 'CARD_DONE' }, NOW);
      expect(result.state).toBe(DJState.song);
    });
  });

  describe('SONG_ENDED', () => {
    it('transitions from song to ceremony', () => {
      const ctx = createTestDJContextInState(DJState.song);
      const result = transition(ctx, { type: 'SONG_ENDED' }, NOW);
      expect(result.state).toBe(DJState.ceremony);
    });

    it('increments songCount', () => {
      const ctx = createTestDJContextInState(DJState.song, { songCount: 3 });
      const result = transition(ctx, { type: 'SONG_ENDED' }, NOW);
      expect(result.songCount).toBe(4);
    });
  });

  describe('CEREMONY_DONE', () => {
    it('transitions from ceremony to interlude (normal)', () => {
      const ctx = createTestDJContextInState(DJState.ceremony);
      const result = transition(ctx, { type: 'CEREMONY_DONE' }, NOW);
      expect(result.state).toBe(DJState.interlude);
    });

    it('skips interlude with low participants (NFR12)', () => {
      const ctx = createTestDJContextInState(DJState.ceremony, { participantCount: 2 });
      const result = transition(ctx, { type: 'CEREMONY_DONE' }, NOW);
      expect(result.state).toBe(DJState.songSelection);
    });
  });

  describe('INTERLUDE_DONE', () => {
    it('transitions from interlude to songSelection', () => {
      const ctx = createTestDJContextInState(DJState.interlude);
      const result = transition(ctx, { type: 'INTERLUDE_DONE' }, NOW);
      expect(result.state).toBe(DJState.songSelection);
    });
  });

  describe('TIMEOUT', () => {
    it('auto-advances from each timed state', () => {
      const cases: [DJState, DJState][] = [
        [DJState.songSelection, DJState.partyCardDeal],
        [DJState.partyCardDeal, DJState.song],
        [DJState.song, DJState.ceremony],
        [DJState.ceremony, DJState.interlude],
        [DJState.interlude, DJState.songSelection],
      ];

      for (const [from, expectedTo] of cases) {
        const ctx = createTestDJContextInState(from);
        const result = transition(ctx, { type: 'TIMEOUT' }, NOW);
        expect(result.state).toBe(expectedTo);
      }
    });

    it('rejects from lobby', () => {
      const ctx = createTestDJContext();
      expect(() => transition(ctx, { type: 'TIMEOUT' }, NOW)).toThrow(DJEngineError);
    });

    it('rejects from finale', () => {
      const ctx = createTestDJContextInState(DJState.finale);
      expect(() => transition(ctx, { type: 'TIMEOUT' }, NOW)).toThrow(DJEngineError);
    });
  });

  describe('HOST_SKIP', () => {
    it('advances to next cycle state from any mid-cycle state', () => {
      const ctx = createTestDJContextInState(DJState.ceremony);
      const result = transition(ctx, { type: 'HOST_SKIP' }, NOW);
      expect(result.state).toBe(DJState.interlude);
    });

    it('rejects from lobby', () => {
      const ctx = createTestDJContext();
      expect(() => transition(ctx, { type: 'HOST_SKIP' }, NOW)).toThrow(DJEngineError);
    });
  });

  describe('HOST_OVERRIDE', () => {
    it('jumps to specified target state', () => {
      const ctx = createTestDJContextInState(DJState.interlude);
      const result = transition(ctx, { type: 'HOST_OVERRIDE', targetState: DJState.songSelection }, NOW);
      expect(result.state).toBe(DJState.songSelection);
    });

    it('rejects override to lobby', () => {
      const ctx = createTestDJContextInState(DJState.song);
      expect(() => transition(ctx, { type: 'HOST_OVERRIDE', targetState: DJState.lobby }, NOW)).toThrow(DJEngineError);
      expect(() => transition(ctx, { type: 'HOST_OVERRIDE', targetState: DJState.lobby }, NOW)).toThrow('only mid-cycle states');
    });

    it('rejects override to finale', () => {
      const ctx = createTestDJContextInState(DJState.song);
      expect(() => transition(ctx, { type: 'HOST_OVERRIDE', targetState: DJState.finale }, NOW)).toThrow(DJEngineError);
    });
  });

  describe('END_PARTY', () => {
    it('transitions any mid-cycle state to finale', () => {
      const states: DJState[] = [
        DJState.lobby, DJState.songSelection, DJState.partyCardDeal,
        DJState.song, DJState.ceremony, DJState.interlude,
      ];

      for (const state of states) {
        const ctx = state === DJState.lobby
          ? createTestDJContext()
          : createTestDJContextInState(state);
        const result = transition(ctx, { type: 'END_PARTY' }, NOW);
        expect(result.state).toBe(DJState.finale);
      }
    });

    it('rejects from finale (terminal state)', () => {
      const ctx = createTestDJContextInState(DJState.finale);
      expect(() => transition(ctx, { type: 'END_PARTY' }, NOW)).toThrow(DJEngineError);
    });
  });

  describe('immutability', () => {
    it('does not mutate input context', () => {
      const ctx = createTestDJContextInState(DJState.songSelection);
      const original = { ...ctx, cycleHistory: [...ctx.cycleHistory], metadata: { ...ctx.metadata } };
      transition(ctx, { type: 'SONG_SELECTED' }, NOW);
      expect(ctx).toEqual(original);
    });
  });

  describe('cycleHistory tracking', () => {
    it('appends new state to cycleHistory', () => {
      const ctx = createTestDJContext();
      const result = transition(ctx, { type: 'SESSION_STARTED' }, NOW);
      expect(result.cycleHistory).toContain(DJState.songSelection);
      expect(result.cycleHistory.length).toBe(ctx.cycleHistory.length + 1);
    });
  });

  describe('low-participant metadata (NFR12)', () => {
    it('sets forcedQuickCeremony when participantCount < 3', () => {
      const ctx = createTestDJContextInState(DJState.songSelection, { participantCount: 2 });
      const result = transition(ctx, { type: 'SONG_SELECTED' }, NOW);
      expect(result.metadata.forcedQuickCeremony).toBe(true);
    });

    it('does not set forcedQuickCeremony when participantCount >= 3', () => {
      const ctx = createTestDJContextInState(DJState.songSelection, { participantCount: 3 });
      const result = transition(ctx, { type: 'SONG_SELECTED' }, NOW);
      expect(result.metadata.forcedQuickCeremony).toBeUndefined();
    });
  });

  describe('invalid transitions', () => {
    it('rejects transitions not in allowed list', () => {
      const ctx = createTestDJContextInState(DJState.song);
      const invalidEvents: DJTransition[] = [
        { type: 'SESSION_STARTED' },
        { type: 'SONG_SELECTED' },
        { type: 'CARD_DEALT' },
        { type: 'CEREMONY_DONE' },
        { type: 'INTERLUDE_DONE' },
      ];

      for (const event of invalidEvents) {
        expect(() => transition(ctx, event, NOW)).toThrow(DJEngineError);
      }
    });

    it('error includes state info', () => {
      const ctx = createTestDJContextInState(DJState.song);
      try {
        transition(ctx, { type: 'SESSION_STARTED' }, NOW);
      } catch (e) {
        expect(e).toBeInstanceOf(DJEngineError);
        expect((e as DJEngineError).code).toBe('INVALID_STATE');
      }
    });
  });
});
