// Ceremony type selection — pure function, ZERO imports from outside dj-engine/

import { CeremonyType, DJState } from './types.js';
import type { DJContext } from './types.js';

/**
 * Determine ceremony type based on session context.
 * Rules evaluated in priority order (first match wins):
 * 1. Small group (<3 participants) → quick
 * 2. First song of session (songCount === 1) → full
 * 3. After song 5 (songCount >= 5) → quick
 * 4. Post-interlude AND last ceremony wasn't full → full
 * 5. Last ceremony was full → quick (no consecutive full)
 * 6. Default → full
 */
export function selectCeremonyType(context: DJContext): CeremonyType {
  // Rule 1: Small group always gets quick (NFR12)
  if (context.participantCount < 3) {
    return CeremonyType.quick;
  }

  // Rule 2: First song of session always gets full
  if (context.songCount === 1) {
    return CeremonyType.full;
  }

  // Rule 3: After song 5, default to quick
  if (context.songCount >= 5) {
    return CeremonyType.quick;
  }

  // Rule 4: First song after interlude gets full
  if (wasPostInterlude(context.cycleHistory)) {
    // But check Rule 5 first: no consecutive full ceremonies
    const lastCeremonyType = context.metadata.lastCeremonyType as CeremonyType | undefined;
    if (lastCeremonyType === CeremonyType.full) {
      return CeremonyType.quick;
    }
    return CeremonyType.full;
  }

  // Rule 5: No two consecutive full ceremonies
  const lastCeremonyType = context.metadata.lastCeremonyType as CeremonyType | undefined;
  if (lastCeremonyType === CeremonyType.full) {
    return CeremonyType.quick;
  }

  // Default: full ceremony
  return CeremonyType.full;
}

/**
 * Check if the current mini-cycle started after an interlude.
 * Walks cycleHistory backwards to find the most recent songSelection,
 * then checks if the state immediately before it is interlude.
 */
export function wasPostInterlude(cycleHistory: DJState[]): boolean {
  for (let i = cycleHistory.length - 1; i >= 0; i--) {
    if (cycleHistory[i] === DJState.songSelection) {
      return i > 0 && cycleHistory[i - 1] === DJState.interlude;
    }
  }
  return false;
}
