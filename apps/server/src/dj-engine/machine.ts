// DJ Engine machine orchestrator — main entry points
// ZERO imports from outside dj-engine/

import { DJState } from './types.js';
import type { DJContext, DJTransition, DJSideEffect } from './types.js';
import { transition } from './transitions.js';
import { getStateConfig } from './states.js';
import { createTimerConfig } from './timers.js';
import { serializeDJContext } from './serializer.js';

const DEFAULT_TIMER_CONFIG = createTimerConfig();

/**
 * Create a new DJ context initialized in lobby state.
 */
export function createDJContext(sessionId: string, participantCount: number): DJContext {
  return {
    state: DJState.lobby,
    sessionId,
    participantCount,
    songCount: 0,
    sessionStartedAt: null,
    currentPerformer: null,
    currentSongTitle: null,
    timerStartedAt: null,
    timerDurationMs: null,
    isPaused: false,
    pausedAt: null,
    pausedFromState: null,
    timerRemainingMs: null,
    cycleHistory: [DJState.lobby],
    metadata: {},
  };
}

/**
 * Process a transition and return new context + side effects.
 * Pure function — caller provides `now` timestamp. Side effects are DATA, not execution.
 */
export function processTransition(
  context: DJContext,
  event: DJTransition,
  now: number = Date.now()
): { newContext: DJContext; sideEffects: DJSideEffect[] } {
  const previousState = context.state;
  let newContext = transition(context, event, now);
  const sideEffects: DJSideEffect[] = [];

  // Always cancel any existing timer first
  sideEffects.push({ type: 'cancelTimer', data: {} });

  // Broadcast state change
  sideEffects.push({
    type: 'broadcast',
    data: { from: previousState, to: newContext.state },
  });

  // Schedule timer if new state has timeout
  const stateConfig = getStateConfig(newContext.state);
  if (stateConfig.hasTimeout) {
    const durationMs = DEFAULT_TIMER_CONFIG[newContext.state];
    if (durationMs > 0) {
      newContext = {
        ...newContext,
        timerStartedAt: now,
        timerDurationMs: durationMs,
      };

      sideEffects.push({
        type: 'scheduleTimer',
        data: { durationMs, transitionEvent: 'TIMEOUT' },
      });
    }
  }

  // Persist new context
  sideEffects.push({
    type: 'persist',
    data: { context: serializeDJContext(newContext) },
  });

  return { newContext, sideEffects };
}
