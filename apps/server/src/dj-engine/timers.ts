// Timer management — pure data, no actual setTimeout scheduling
// ZERO imports from outside dj-engine/

import type { DJContext, DJTransition, TimerConfig } from './types.js';
import { DJState } from './types.js';

/**
 * Default timer durations per state (in milliseconds).
 */
const DEFAULT_TIMER_DURATIONS: TimerConfig = {
  [DJState.lobby]: 0,           // No timeout — waits for host to start
  [DJState.songSelection]: 15_000,    // 15s Quick Pick voting window
  [DJState.partyCardDeal]: 15_000,    // 15s: card display + future accept/dismiss interaction (Story 4.5)
  [DJState.song]: 180_000,            // 180s (3 minutes)
  [DJState.ceremony]: 12_000,         // 12s: 2s anticipation + 10s reveal display
  [DJState.interlude]: 15_000,        // 15s placeholder (TODO: Epic 7)
  [DJState.finale]: 0,                // No timeout — session ends explicitly
};

/**
 * Create a timer config with optional overrides.
 */
export function createTimerConfig(overrides?: Partial<TimerConfig>): TimerConfig {
  return { ...DEFAULT_TIMER_DURATIONS, ...overrides };
}

/**
 * Get the TIMEOUT transition event for auto-advancement.
 * Every timed state uses TIMEOUT as the timer-fired event.
 */
export function getNextTransition(): DJTransition {
  return { type: 'TIMEOUT' };
}

/**
 * Calculate remaining time for crash recovery timer reconciliation.
 * Returns remaining ms, or 0 if timer has already expired.
 */
export function calculateRemainingMs(context: DJContext, now: number): number {
  if (context.timerStartedAt === null || context.timerDurationMs === null) {
    return 0;
  }

  const elapsed = now - context.timerStartedAt;
  const remaining = context.timerDurationMs - elapsed;
  return Math.max(0, remaining);
}
