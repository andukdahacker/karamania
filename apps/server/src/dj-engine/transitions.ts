// Transition guards and core transition logic
// ZERO imports from outside dj-engine/

import { DJState, DJEngineError } from './types.js';
import type { DJContext, DJTransition } from './types.js';
import { getStateConfig, getNextCycleState, isValidOverrideTarget } from './states.js';
import { selectCeremonyType } from './ceremony-selection.js';

/**
 * Guard: can start a session (lobby -> songSelection)?
 */
function canStartSession(context: DJContext): void {
  if (context.state !== DJState.lobby) {
    throw new DJEngineError('INVALID_STATE', `Cannot start session from state '${context.state}', must be in 'lobby'`);
  }
  if (context.participantCount < 1) {
    throw new DJEngineError('INSUFFICIENT_PARTICIPANTS', 'Cannot start session with zero participants');
  }
}

/**
 * Guard: is the current state valid for this transition?
 */
function validateTransitionAllowed(context: DJContext, event: DJTransition): void {
  const config = getStateConfig(context.state);
  if (!config.allowedTransitions.includes(event.type)) {
    throw new DJEngineError(
      'INVALID_TRANSITION',
      `Transition '${event.type}' is not allowed from state '${context.state}'`
    );
  }
}

/**
 * Guard: validate HOST_OVERRIDE target state.
 */
function validateOverrideTarget(targetState: DJState): void {
  if (!isValidOverrideTarget(targetState)) {
    throw new DJEngineError(
      'INVALID_OVERRIDE_TARGET',
      `Cannot override to state '${targetState}' — only mid-cycle states are valid targets`
    );
  }
}

/**
 * Compute the next state for a given transition event.
 */
function computeNextState(context: DJContext, event: DJTransition): DJState {
  switch (event.type) {
    case 'SESSION_STARTED':
      return DJState.songSelection;

    case 'SONG_SELECTED':
    case 'CARD_DEALT':
    case 'CARD_DONE':
    case 'SONG_ENDED':
    case 'CEREMONY_DONE':
    case 'INTERLUDE_DONE':
    case 'TIMEOUT':
    case 'HOST_SKIP':
      return getNextCycleState(context.state, context.participantCount);

    case 'HOST_OVERRIDE':
      return event.targetState;

    case 'END_PARTY':
      return DJState.finale;
  }
}

/**
 * Core pure transition function.
 * Takes current context and event, returns new context (immutable — never mutates input).
 * Caller serializes access for concurrency control.
 */
export function transition(context: DJContext, event: DJTransition, now: number): DJContext {
  // Run guards
  if (event.type === 'SESSION_STARTED') {
    canStartSession(context);
  }

  validateTransitionAllowed(context, event);

  if (event.type === 'HOST_OVERRIDE') {
    validateOverrideTarget(event.targetState);
  }

  const nextState = computeNextState(context, event);

  // Determine ceremony type metadata
  let ceremonyMetadata: Record<string, unknown> = {};
  if (nextState === DJState.ceremony) {
    const evalContext: DJContext = {
      ...context,
      state: nextState,
      songCount: event.type === 'SONG_ENDED' ? context.songCount + 1 : context.songCount,
      cycleHistory: [...context.cycleHistory, nextState],
    };
    const ceremonyType = selectCeremonyType(evalContext);
    ceremonyMetadata = { ceremonyType, lastCeremonyType: ceremonyType };
  } else {
    ceremonyMetadata = context.metadata.lastCeremonyType
      ? { ceremonyType: undefined, lastCeremonyType: context.metadata.lastCeremonyType }
      : { ceremonyType: undefined };
  }

  // Build new context (immutable — never mutate input)
  return {
    ...context,
    state: nextState,
    cycleHistory: [...context.cycleHistory, nextState],
    metadata: {
      ...context.metadata,
      ...ceremonyMetadata,
      ...(context.participantCount < 3 ? { forcedQuickCeremony: true } : {}),
    },
    sessionStartedAt: event.type === 'SESSION_STARTED' ? now : context.sessionStartedAt,
    songCount: event.type === 'SONG_ENDED' ? context.songCount + 1 : context.songCount,
    timerStartedAt: null,
    timerDurationMs: null,
  };
}
