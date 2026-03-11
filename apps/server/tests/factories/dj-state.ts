// Test factory for DJContext — shared across all dj-engine tests
// No inline test data allowed (Story 2.1 AC)

import type { DJContext } from '../../src/dj-engine/types.js';
import { DJState } from '../../src/dj-engine/types.js';

const DEFAULT_SESSION_ID = 'test-session-001';

/**
 * Create a test DJContext with sensible defaults.
 * Defaults: state=lobby, participantCount=3, songCount=0
 */
export function createTestDJContext(overrides?: Partial<DJContext>): DJContext {
  return {
    state: DJState.lobby,
    sessionId: DEFAULT_SESSION_ID,
    participantCount: 3,
    songCount: 0,
    sessionStartedAt: null,
    currentPerformer: null,
    timerStartedAt: null,
    timerDurationMs: null,
    isPaused: false,
    pausedAt: null,
    pausedFromState: null,
    timerRemainingMs: null,
    cycleHistory: [DJState.lobby],
    metadata: {},
    ...overrides,
  };
}

/**
 * Create a test DJContext already in a specific state.
 * Sets cycleHistory to include lobby + the target state.
 */
export function createTestDJContextInState(state: DJState, overrides?: Partial<DJContext>): DJContext {
  return createTestDJContext({
    state,
    cycleHistory: [DJState.lobby, state],
    sessionStartedAt: state !== DJState.lobby ? Date.now() : null,
    ...overrides,
  });
}
