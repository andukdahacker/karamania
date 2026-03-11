// DJ context serialization for JSONB persistence round-trips
// ZERO imports from outside dj-engine/

import { DJState, DJEngineError } from './types.js';
import type { DJContext } from './types.js';

const VALID_STATES = new Set<string>(Object.values(DJState));

/**
 * Serialize DJContext to a JSON-safe object for JSONB storage.
 */
export function serializeDJContext(context: DJContext): unknown {
  return {
    state: context.state,
    sessionId: context.sessionId,
    participantCount: context.participantCount,
    songCount: context.songCount,
    sessionStartedAt: context.sessionStartedAt,
    currentPerformer: context.currentPerformer,
    timerStartedAt: context.timerStartedAt,
    timerDurationMs: context.timerDurationMs,
    isPaused: context.isPaused,
    pausedAt: context.pausedAt,
    pausedFromState: context.pausedFromState,
    timerRemainingMs: context.timerRemainingMs,
    cycleHistory: [...context.cycleHistory],
    metadata: { ...context.metadata },
  };
}

/**
 * Deserialize DJContext from JSONB with validation.
 * Round-trip guarantee: deserializeDJContext(serializeDJContext(ctx)) deep-equals ctx.
 */
export function deserializeDJContext(json: unknown): DJContext {
  if (json === null || json === undefined || typeof json !== 'object') {
    throw new DJEngineError('INVALID_DJ_CONTEXT', 'DJ context must be a non-null object');
  }

  const obj = json as Record<string, unknown>;

  // Validate state
  if (typeof obj.state !== 'string' || !VALID_STATES.has(obj.state)) {
    throw new DJEngineError('INVALID_DJ_STATE', `Invalid DJ state: '${String(obj.state)}'`);
  }

  // Validate sessionId
  if (typeof obj.sessionId !== 'string' || obj.sessionId.length === 0) {
    throw new DJEngineError('INVALID_SESSION_ID', 'sessionId must be a non-empty string');
  }

  // Validate participantCount
  if (typeof obj.participantCount !== 'number' || !Number.isInteger(obj.participantCount)) {
    throw new DJEngineError('INVALID_PARTICIPANT_COUNT', 'participantCount must be an integer');
  }

  // Validate songCount
  if (typeof obj.songCount !== 'number' || !Number.isInteger(obj.songCount)) {
    throw new DJEngineError('INVALID_SONG_COUNT', 'songCount must be an integer');
  }

  // Validate nullable number fields
  validateNullableNumber(obj.sessionStartedAt, 'sessionStartedAt');
  validateNullableNumber(obj.timerStartedAt, 'timerStartedAt');
  validateNullableNumber(obj.timerDurationMs, 'timerDurationMs');
  validateNullableNumber(obj.pausedAt, 'pausedAt');
  validateNullableNumber(obj.timerRemainingMs, 'timerRemainingMs');

  // Validate isPaused
  if (typeof obj.isPaused !== 'boolean') {
    throw new DJEngineError('INVALID_ISPAUSED', 'isPaused must be a boolean');
  }

  // Validate pausedFromState
  if (obj.pausedFromState !== null && (typeof obj.pausedFromState !== 'string' || !VALID_STATES.has(obj.pausedFromState))) {
    throw new DJEngineError('INVALID_PAUSEDFROMSTATE', 'pausedFromState must be a valid DJState or null');
  }

  // Validate nullable string fields
  if (obj.currentPerformer !== null && typeof obj.currentPerformer !== 'string') {
    throw new DJEngineError('INVALID_CURRENT_PERFORMER', 'currentPerformer must be a string or null');
  }

  // Validate cycleHistory
  if (!Array.isArray(obj.cycleHistory)) {
    throw new DJEngineError('INVALID_CYCLE_HISTORY', 'cycleHistory must be an array');
  }
  for (const entry of obj.cycleHistory) {
    if (typeof entry !== 'string' || !VALID_STATES.has(entry)) {
      throw new DJEngineError('INVALID_CYCLE_HISTORY', `Invalid state in cycleHistory: '${String(entry)}'`);
    }
  }

  // Validate metadata
  if (obj.metadata === null || obj.metadata === undefined || typeof obj.metadata !== 'object' || Array.isArray(obj.metadata)) {
    throw new DJEngineError('INVALID_METADATA', 'metadata must be a non-null object');
  }

  return {
    state: obj.state as DJState,
    sessionId: obj.sessionId as string,
    participantCount: obj.participantCount as number,
    songCount: obj.songCount as number,
    sessionStartedAt: (obj.sessionStartedAt as number | null) ?? null,
    currentPerformer: (obj.currentPerformer as string | null) ?? null,
    timerStartedAt: (obj.timerStartedAt as number | null) ?? null,
    timerDurationMs: (obj.timerDurationMs as number | null) ?? null,
    isPaused: obj.isPaused as boolean,
    pausedAt: (obj.pausedAt as number | null) ?? null,
    pausedFromState: (obj.pausedFromState as DJState | null) ?? null,
    timerRemainingMs: (obj.timerRemainingMs as number | null) ?? null,
    cycleHistory: [...(obj.cycleHistory as DJState[])],
    metadata: { ...(obj.metadata as Record<string, unknown>) },
  };
}

function validateNullableNumber(value: unknown, fieldName: string): void {
  if (value !== null && value !== undefined && typeof value !== 'number') {
    throw new DJEngineError(`INVALID_${fieldName.toUpperCase()}` as string, `${fieldName} must be a number or null`);
  }
}
