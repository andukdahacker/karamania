// DJ Engine type definitions
// ZERO imports from outside dj-engine/ — pure logic module

/**
 * DJ engine states matching Flutter's DJState enum exactly.
 * Serialized as strings in dj:stateChanged events and sessions.dj_state JSONB.
 */
export const DJState = {
  lobby: 'lobby',
  icebreaker: 'icebreaker',
  songSelection: 'songSelection',
  partyCardDeal: 'partyCardDeal',
  song: 'song',
  ceremony: 'ceremony',
  interlude: 'interlude',
  finale: 'finale',
} as const;

export type DJState = (typeof DJState)[keyof typeof DJState];

/**
 * Ceremony types: full (anticipation → reveal) or quick (immediate reveal).
 * Selected by ceremony-selection.ts based on session context.
 */
export const CeremonyType = {
  full: 'full',
  quick: 'quick',
} as const;

export type CeremonyType = (typeof CeremonyType)[keyof typeof CeremonyType];

/**
 * All valid transition event types for the DJ state machine.
 * Pause/resume are NOT transitions — they are session-level operations (Story 2.6).
 */
export type DJTransition =
  | { type: 'SESSION_STARTED' }
  | { type: 'SONG_SELECTED' }
  | { type: 'SONG_ENDED' }
  | { type: 'CEREMONY_DONE' }
  | { type: 'ICEBREAKER_DONE' }
  | { type: 'INTERLUDE_DONE' }
  | { type: 'CARD_DEALT' }
  | { type: 'CARD_DONE' }
  | { type: 'HOST_SKIP' }
  | { type: 'HOST_OVERRIDE'; targetState: DJState }
  | { type: 'TIMEOUT' }
  | { type: 'END_PARTY' };

/**
 * Core DJ engine context — full state of the game loop.
 * Immutable: transition() returns a new context, never mutates.
 */
export interface DJContext {
  state: DJState;
  sessionId: string;
  participantCount: number;
  songCount: number;
  sessionStartedAt: number | null;
  currentPerformer: string | null;
  currentSongTitle: string | null;
  timerStartedAt: number | null;
  timerDurationMs: number | null;
  isPaused: boolean;
  pausedAt: number | null;
  pausedFromState: DJState | null;
  timerRemainingMs: number | null;
  cycleHistory: DJState[];
  metadata: Record<string, unknown>;
}

/**
 * Timer configuration: default timeout in ms per state.
 */
export type TimerConfig = Record<DJState, number>;

/**
 * Side effects returned by processTransition — data, not execution.
 * The caller (socket-handler/service) interprets and performs actual I/O.
 */
export type DJSideEffect =
  | { type: 'broadcast'; data: { from: DJState; to: DJState } }
  | { type: 'scheduleTimer'; data: { durationMs: number; transitionEvent: 'TIMEOUT' } }
  | { type: 'cancelTimer'; data: Record<string, never> }
  | { type: 'persist'; data: { context: unknown } };

/**
 * DJ-specific error type — local to dj-engine, does NOT import AppError from shared/.
 */
export class DJEngineError extends Error {
  readonly code: string;

  constructor(code: string, message: string) {
    super(message);
    this.name = 'DJEngineError';
    this.code = code;
  }
}

/**
 * State configuration: defines allowed transitions and timeout behavior per state.
 */
export interface StateConfig {
  allowedTransitions: DJTransition['type'][];
  hasTimeout: boolean;
  isPlaceholder: boolean;
}
