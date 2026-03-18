// Peak reaction detection — pure logic, zero Socket.io dependency
// Detects sustained reaction rate spikes above session baseline (FR73)

export const WINDOW_MS = 10_000; // 10-second sliding window for current rate
export const BASELINE_WINDOW_MS = 300_000; // 5-minute rolling window for baseline
export const SPIKE_MULTIPLIER = 3.0; // current rate must be 3x baseline
export const MIN_REACTIONS_FOR_PEAK = 8; // absolute minimum to prevent false positives
export const PEAK_COOLDOWN_MS = 60_000; // suppress peaks for 60s after detection

interface SessionPeakState {
  reactionTimestamps: number[];
  lastPeakAt: number;
}

const sessionState = new Map<string, SessionPeakState>();

export function recordReaction(sessionId: string, now: number): boolean {
  let state = sessionState.get(sessionId);
  if (!state) {
    state = { reactionTimestamps: [], lastPeakAt: 0 };
    sessionState.set(sessionId, state);
  }

  // 1. Append timestamp
  state.reactionTimestamps.push(now);

  // 2. Prune timestamps older than BASELINE_WINDOW_MS
  const baselineCutoff = now - BASELINE_WINDOW_MS;
  const firstValid = state.reactionTimestamps.findIndex(t => t >= baselineCutoff);
  if (firstValid > 0) {
    state.reactionTimestamps.splice(0, firstValid);
  }

  // 3. Peak cooldown check
  if (now - state.lastPeakAt < PEAK_COOLDOWN_MS) return false;

  // 4. Count reactions in current window
  const windowCutoff = now - WINDOW_MS;
  let currentCount = 0;
  for (let i = state.reactionTimestamps.length - 1; i >= 0; i--) {
    if (state.reactionTimestamps[i]! >= windowCutoff) {
      currentCount++;
    } else {
      break;
    }
  }

  // 5. Absolute minimum check
  if (currentCount < MIN_REACTIONS_FOR_PEAK) return false;

  // 6. Baseline rate calculation
  const baselineTotal = state.reactionTimestamps.length;
  const baselineRate = (baselineTotal / BASELINE_WINDOW_MS) * WINDOW_MS;

  // 7. Spike detection
  if (currentCount >= baselineRate * SPIKE_MULTIPLIER) {
    state.lastPeakAt = now;
    return true;
  }

  return false;
}

/** Reset lastPeakAt so cooldown is not wasted when bubble was suppressed externally. */
export function resetLastPeak(sessionId: string): void {
  const state = sessionState.get(sessionId);
  if (state) {
    state.lastPeakAt = 0;
  }
}

export function clearSession(sessionId: string): void {
  sessionState.delete(sessionId);
}

export function clearAllSessions(): void {
  sessionState.clear();
}
