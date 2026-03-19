import { describe, it, expect } from 'vitest';
import { createDJContext, processTransition } from '../../src/dj-engine/machine.js';
import { DJState, DJEngineError } from '../../src/dj-engine/types.js';
import type { DJSideEffect } from '../../src/dj-engine/types.js';
import { createTestDJContext, createTestDJContextInState } from '../factories/dj-state.js';

const NOW = 1_000_000;

describe('createDJContext', () => {
  it('initializes in lobby state', () => {
    const ctx = createDJContext('session-1', 3);
    expect(ctx.state).toBe(DJState.lobby);
  });

  it('sets sessionId and participantCount', () => {
    const ctx = createDJContext('session-1', 5);
    expect(ctx.sessionId).toBe('session-1');
    expect(ctx.participantCount).toBe(5);
  });

  it('initializes with zero songCount', () => {
    const ctx = createDJContext('session-1', 3);
    expect(ctx.songCount).toBe(0);
  });

  it('initializes nullable fields as null', () => {
    const ctx = createDJContext('session-1', 3);
    expect(ctx.sessionStartedAt).toBeNull();
    expect(ctx.currentPerformer).toBeNull();
    expect(ctx.timerStartedAt).toBeNull();
    expect(ctx.timerDurationMs).toBeNull();
  });

  it('initializes pause fields with defaults', () => {
    const ctx = createDJContext('session-1', 3);
    expect(ctx.isPaused).toBe(false);
    expect(ctx.pausedAt).toBeNull();
    expect(ctx.pausedFromState).toBeNull();
    expect(ctx.timerRemainingMs).toBeNull();
  });

  it('initializes cycleHistory with lobby', () => {
    const ctx = createDJContext('session-1', 3);
    expect(ctx.cycleHistory).toEqual([DJState.lobby]);
  });

  it('initializes empty metadata', () => {
    const ctx = createDJContext('session-1', 3);
    expect(ctx.metadata).toEqual({});
  });
});

describe('processTransition', () => {
  it('returns newContext and sideEffects', () => {
    const ctx = createTestDJContext();
    const result = processTransition(ctx, { type: 'SESSION_STARTED' }, NOW);
    expect(result.newContext).toBeDefined();
    expect(result.sideEffects).toBeInstanceOf(Array);
  });

  describe('side effects', () => {
    it('always includes cancelTimer as first effect', () => {
      const ctx = createTestDJContext();
      const { sideEffects } = processTransition(ctx, { type: 'SESSION_STARTED' }, NOW);
      expect(sideEffects[0]).toEqual({ type: 'cancelTimer', data: {} });
    });

    it('includes broadcast with from/to states', () => {
      const ctx = createTestDJContext();
      const { sideEffects } = processTransition(ctx, { type: 'SESSION_STARTED' }, NOW);
      const broadcast = sideEffects.find((e): e is Extract<DJSideEffect, { type: 'broadcast' }> => e.type === 'broadcast');
      expect(broadcast).toBeDefined();
      expect(broadcast!.data.from).toBe(DJState.lobby);
      expect(broadcast!.data.to).toBe(DJState.icebreaker);
    });

    it('schedules timer for timed states', () => {
      const ctx = createTestDJContext();
      const { sideEffects } = processTransition(ctx, { type: 'SESSION_STARTED' }, NOW);
      const timer = sideEffects.find((e): e is Extract<DJSideEffect, { type: 'scheduleTimer' }> => e.type === 'scheduleTimer');
      expect(timer).toBeDefined();
      expect(timer!.data.durationMs).toBe(6_000); // icebreaker default (6s)
      expect(timer!.data.transitionEvent).toBe('TIMEOUT');
    });

    it('does not schedule timer for non-timed states (finale)', () => {
      const ctx = createTestDJContextInState(DJState.song);
      const { sideEffects } = processTransition(ctx, { type: 'END_PARTY' }, NOW);
      const timer = sideEffects.find(e => e.type === 'scheduleTimer');
      expect(timer).toBeUndefined();
    });

    it('always includes persist as last effect', () => {
      const ctx = createTestDJContext();
      const { sideEffects } = processTransition(ctx, { type: 'SESSION_STARTED' }, NOW);
      const lastEffect = sideEffects[sideEffects.length - 1];
      expect(lastEffect?.type).toBe('persist');
    });

    it('persist data contains serialized context', () => {
      const ctx = createTestDJContext();
      const { sideEffects } = processTransition(ctx, { type: 'SESSION_STARTED' }, NOW);
      const persist = sideEffects.find((e): e is Extract<DJSideEffect, { type: 'persist' }> => e.type === 'persist');
      expect(persist).toBeDefined();
      const data = persist!.data as { context: Record<string, unknown> };
      expect(data.context).toBeDefined();
      expect((data.context as Record<string, unknown>).state).toBe(DJState.icebreaker);
    });
  });

  it('sets timer fields on context to exact now value for timed states', () => {
    const ctx = createTestDJContext();
    const { newContext } = processTransition(ctx, { type: 'SESSION_STARTED' }, NOW);
    expect(newContext.timerStartedAt).toBe(NOW);
    expect(newContext.timerDurationMs).toBe(6_000);
  });

  it('throws DJEngineError for invalid transitions', () => {
    const ctx = createTestDJContext();
    expect(() => processTransition(ctx, { type: 'SONG_ENDED' }, NOW)).toThrow(DJEngineError);
  });

  describe('full cycle test', () => {
    it('completes full cycle: lobby -> icebreaker -> songSelection -> partyCardDeal -> song -> ceremony -> interlude -> songSelection', () => {
      let ctx = createDJContext('cycle-test', 3);

      // lobby -> icebreaker
      const r0 = processTransition(ctx, { type: 'SESSION_STARTED' }, NOW);
      expect(r0.newContext.state).toBe(DJState.icebreaker);
      ctx = r0.newContext;

      // icebreaker -> songSelection
      const r1 = processTransition(ctx, { type: 'ICEBREAKER_DONE' }, NOW);
      expect(r1.newContext.state).toBe(DJState.songSelection);
      ctx = r1.newContext;

      // songSelection -> partyCardDeal
      const r2 = processTransition(ctx, { type: 'SONG_SELECTED' }, NOW);
      expect(r2.newContext.state).toBe(DJState.partyCardDeal);
      ctx = r2.newContext;

      // partyCardDeal -> song (TIMEOUT auto-advance placeholder)
      const r3 = processTransition(ctx, { type: 'TIMEOUT' }, NOW);
      expect(r3.newContext.state).toBe(DJState.song);
      ctx = r3.newContext;

      // song -> ceremony
      const r4 = processTransition(ctx, { type: 'SONG_ENDED' }, NOW);
      expect(r4.newContext.state).toBe(DJState.ceremony);
      expect(r4.newContext.songCount).toBe(1);
      ctx = r4.newContext;

      // ceremony -> interlude (TIMEOUT auto-advance placeholder)
      const r5 = processTransition(ctx, { type: 'TIMEOUT' }, NOW);
      expect(r5.newContext.state).toBe(DJState.interlude);
      ctx = r5.newContext;

      // interlude -> songSelection (loop!)
      const r6 = processTransition(ctx, { type: 'TIMEOUT' }, NOW);
      expect(r6.newContext.state).toBe(DJState.songSelection);
    });
  });

  describe('immutability under concurrent-style access', () => {
    it('two transitions on same context produce valid results independently without mutation', () => {
      const ctx = createTestDJContextInState(DJState.songSelection);

      // Two events processed on the same (immutable) context — simulates concurrent access
      // In production, the caller serializes access; here we verify the engine never mutates input
      const r1 = processTransition(ctx, { type: 'SONG_SELECTED' }, NOW);
      const r2 = processTransition(ctx, { type: 'HOST_SKIP' }, NOW);

      // Both should succeed independently
      expect(r1.newContext.state).toBe(DJState.partyCardDeal);
      expect(r2.newContext.state).toBe(DJState.partyCardDeal);

      // Original context is unchanged (immutability guarantee)
      expect(ctx.state).toBe(DJState.songSelection);
    });
  });

  describe('timed states auto-advance', () => {
    it('partyCardDeal auto-advances via TIMEOUT', () => {
      const ctx = createTestDJContextInState(DJState.partyCardDeal);
      const { newContext } = processTransition(ctx, { type: 'TIMEOUT' }, NOW);
      expect(newContext.state).toBe(DJState.song);
    });

    it('ceremony auto-advances via TIMEOUT', () => {
      const ctx = createTestDJContextInState(DJState.ceremony);
      const { newContext } = processTransition(ctx, { type: 'TIMEOUT' }, NOW);
      expect(newContext.state).toBe(DJState.interlude);
    });

    it('interlude auto-advances via TIMEOUT', () => {
      const ctx = createTestDJContextInState(DJState.interlude);
      const { newContext } = processTransition(ctx, { type: 'TIMEOUT' }, NOW);
      expect(newContext.state).toBe(DJState.songSelection);
    });
  });

  describe('low-participant guards (NFR12)', () => {
    it('skips partyCardDeal when participantCount < 3', () => {
      const ctx = createTestDJContextInState(DJState.songSelection, { participantCount: 2 });
      const { newContext } = processTransition(ctx, { type: 'SONG_SELECTED' }, NOW);
      expect(newContext.state).toBe(DJState.song);
    });

    it('skips interlude when participantCount < 3', () => {
      const ctx = createTestDJContextInState(DJState.ceremony, { participantCount: 1 });
      const { newContext } = processTransition(ctx, { type: 'CEREMONY_DONE' }, NOW);
      expect(newContext.state).toBe(DJState.songSelection);
    });

    it('sets forcedQuickCeremony in metadata', () => {
      const ctx = createTestDJContextInState(DJState.songSelection, { participantCount: 2 });
      const { newContext } = processTransition(ctx, { type: 'SONG_SELECTED' }, NOW);
      expect(newContext.metadata.forcedQuickCeremony).toBe(true);
    });
  });

  describe('HOST_OVERRIDE', () => {
    it('transitions to specified target state', () => {
      const ctx = createTestDJContextInState(DJState.interlude);
      const { newContext } = processTransition(ctx, { type: 'HOST_OVERRIDE', targetState: DJState.songSelection }, NOW);
      expect(newContext.state).toBe(DJState.songSelection);
    });
  });

  describe('songCount and sessionStartedAt', () => {
    it('increments songCount on SONG_ENDED', () => {
      const ctx = createTestDJContextInState(DJState.song, { songCount: 4 });
      const { newContext } = processTransition(ctx, { type: 'SONG_ENDED' }, NOW);
      expect(newContext.songCount).toBe(5);
    });

    it('sets sessionStartedAt to exact now value on SESSION_STARTED', () => {
      const ctx = createTestDJContext();
      const { newContext } = processTransition(ctx, { type: 'SESSION_STARTED' }, NOW);
      expect(newContext.sessionStartedAt).toBe(NOW);
    });
  });

  describe('all tests use factory', () => {
    it('factory produces valid contexts', () => {
      const ctx = createTestDJContext();
      expect(ctx.state).toBe(DJState.lobby);
      expect(ctx.sessionId).toBe('test-session-001');
      expect(ctx.participantCount).toBe(3);
    });

    it('factory supports state-specific creation', () => {
      const ctx = createTestDJContextInState(DJState.song);
      expect(ctx.state).toBe(DJState.song);
      expect(ctx.cycleHistory).toContain(DJState.song);
    });
  });
});
