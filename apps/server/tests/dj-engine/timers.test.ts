import { describe, it, expect } from 'vitest';
import { createTimerConfig, getNextTransition, calculateRemainingMs } from '../../src/dj-engine/timers.js';
import { DJState } from '../../src/dj-engine/types.js';
import { createTestDJContextInState } from '../factories/dj-state.js';

describe('createTimerConfig', () => {
  it('returns default durations for all states', () => {
    const config = createTimerConfig();
    expect(config[DJState.lobby]).toBe(0);
    expect(config[DJState.songSelection]).toBe(30_000);
    expect(config[DJState.partyCardDeal]).toBe(15_000);
    expect(config[DJState.song]).toBe(180_000);
    expect(config[DJState.ceremony]).toBe(12_000);
    expect(config[DJState.interlude]).toBe(15_000);
    expect(config[DJState.finale]).toBe(0);
  });

  it('applies overrides', () => {
    const config = createTimerConfig({ [DJState.song]: 60_000 });
    expect(config[DJState.song]).toBe(60_000);
    expect(config[DJState.songSelection]).toBe(30_000); // unchanged
  });
});

describe('getNextTransition', () => {
  it('returns TIMEOUT transition event', () => {
    const event = getNextTransition();
    expect(event).toEqual({ type: 'TIMEOUT' });
  });
});

describe('calculateRemainingMs', () => {
  it('returns remaining time when timer is active', () => {
    const now = 10_000;
    const ctx = createTestDJContextInState(DJState.song, {
      timerStartedAt: 5_000,
      timerDurationMs: 180_000,
    });
    const remaining = calculateRemainingMs(ctx, now);
    expect(remaining).toBe(175_000);
  });

  it('returns 0 when timer has expired', () => {
    const now = 200_000;
    const ctx = createTestDJContextInState(DJState.song, {
      timerStartedAt: 5_000,
      timerDurationMs: 10_000,
    });
    const remaining = calculateRemainingMs(ctx, now);
    expect(remaining).toBe(0);
  });

  it('returns 0 when timerStartedAt is null', () => {
    const ctx = createTestDJContextInState(DJState.song, {
      timerStartedAt: null,
      timerDurationMs: null,
    });
    expect(calculateRemainingMs(ctx, Date.now())).toBe(0);
  });

  it('returns 0 when timerDurationMs is null', () => {
    const ctx = createTestDJContextInState(DJState.song, {
      timerStartedAt: 1000,
      timerDurationMs: null,
    });
    expect(calculateRemainingMs(ctx, Date.now())).toBe(0);
  });

  it('returns exact duration when just started', () => {
    const now = 5_000;
    const ctx = createTestDJContextInState(DJState.song, {
      timerStartedAt: 5_000,
      timerDurationMs: 30_000,
    });
    expect(calculateRemainingMs(ctx, now)).toBe(30_000);
  });

  it('handles various elapsed times correctly', () => {
    const ctx = createTestDJContextInState(DJState.ceremony, {
      timerStartedAt: 1000,
      timerDurationMs: 10_000,
    });
    expect(calculateRemainingMs(ctx, 1000)).toBe(10_000);  // just started
    expect(calculateRemainingMs(ctx, 6000)).toBe(5_000);    // half elapsed
    expect(calculateRemainingMs(ctx, 11_000)).toBe(0);      // exactly expired
    expect(calculateRemainingMs(ctx, 20_000)).toBe(0);      // well past expired
  });
});
