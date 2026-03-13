// State configuration map — defines allowed transitions and behavior per DJState
// ZERO imports from outside dj-engine/

import { DJState, DJEngineError } from './types.js';
import type { StateConfig } from './types.js';

/**
 * Core cycle order: songSelection -> partyCardDeal -> song -> ceremony -> interlude -> songSelection (repeat)
 * Placeholder states (partyCardDeal, ceremony, interlude) auto-advance via TIMEOUT.
 */
const stateConfigs: Record<DJState, StateConfig> = {
  [DJState.lobby]: {
    allowedTransitions: ['SESSION_STARTED', 'END_PARTY'],
    hasTimeout: false,
    isPlaceholder: false,
  },
  [DJState.songSelection]: {
    allowedTransitions: ['SONG_SELECTED', 'TIMEOUT', 'HOST_SKIP', 'HOST_OVERRIDE', 'END_PARTY'],
    hasTimeout: true,
    isPlaceholder: false,
  },
  [DJState.partyCardDeal]: {
    // TODO: Epic 4 implements full party card behavior
    allowedTransitions: ['CARD_DEALT', 'CARD_DONE', 'TIMEOUT', 'HOST_SKIP', 'HOST_OVERRIDE', 'END_PARTY'],
    hasTimeout: true,
    isPlaceholder: true,
  },
  [DJState.song]: {
    allowedTransitions: ['SONG_ENDED', 'TIMEOUT', 'HOST_SKIP', 'HOST_OVERRIDE', 'END_PARTY'],
    hasTimeout: true,
    isPlaceholder: false,
  },
  [DJState.ceremony]: {
    allowedTransitions: ['CEREMONY_DONE', 'TIMEOUT', 'HOST_SKIP', 'HOST_OVERRIDE', 'END_PARTY'],
    hasTimeout: true,
    isPlaceholder: false,
  },
  [DJState.interlude]: {
    // TODO: Epic 7 implements full interlude behavior
    allowedTransitions: ['INTERLUDE_DONE', 'TIMEOUT', 'HOST_SKIP', 'HOST_OVERRIDE', 'END_PARTY'],
    hasTimeout: true,
    isPlaceholder: true,
  },
  [DJState.finale]: {
    allowedTransitions: [],
    hasTimeout: false,
    isPlaceholder: false,
  },
};

/**
 * Get state configuration for a given DJState.
 */
export function getStateConfig(state: DJState): StateConfig {
  return stateConfigs[state];
}

/**
 * Get the next state in the core cycle.
 * Respects low-participant degradation (NFR12): skip partyCardDeal and interlude when < 3 participants.
 */
export function getNextCycleState(currentState: DJState, participantCount: number): DJState {
  const lowParticipant = participantCount < 3;

  switch (currentState) {
    case DJState.songSelection:
      return lowParticipant ? DJState.song : DJState.partyCardDeal;
    case DJState.partyCardDeal:
      return DJState.song;
    case DJState.song:
      return DJState.ceremony;
    case DJState.ceremony:
      return lowParticipant ? DJState.songSelection : DJState.interlude;
    case DJState.interlude:
      return DJState.songSelection;
    default:
      throw new DJEngineError('INVALID_CYCLE_STATE', `State '${currentState}' is not part of the cycle`);
  }
}

/**
 * Valid override destinations — cannot override to lobby or finale from mid-cycle.
 */
const VALID_OVERRIDE_TARGETS: ReadonlySet<DJState> = new Set([
  DJState.songSelection,
  DJState.partyCardDeal,
  DJState.song,
  DJState.ceremony,
  DJState.interlude,
]);

/**
 * Check if a state is a valid HOST_OVERRIDE destination.
 */
export function isValidOverrideTarget(state: DJState): boolean {
  return VALID_OVERRIDE_TARGETS.has(state);
}
