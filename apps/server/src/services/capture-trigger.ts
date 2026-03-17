import type { DJState } from '../dj-engine/types.js';

// Module-level throttle tracking
const lastBubbleEmittedAt = new Map<string, number>();
const BUBBLE_COOLDOWN_MS = 60_000; // 1 bubble per 60s per session

export type CaptureTriggerType = 'session_start' | 'reaction_peak' | 'post_ceremony' | 'session_end';

export function shouldEmitCaptureBubble(sessionId: string, currentState?: DJState): boolean {
  // Architecture rule: no bubble during ceremony anticipation or silence phases
  if (currentState === 'ceremony') return false;
  const now = Date.now();
  const lastEmitted = lastBubbleEmittedAt.get(sessionId);
  if (lastEmitted && now - lastEmitted < BUBBLE_COOLDOWN_MS) return false;
  return true;
}

export function markBubbleEmitted(sessionId: string): void {
  lastBubbleEmittedAt.set(sessionId, Date.now());
}

export function clearCaptureTriggerState(sessionId: string): void {
  lastBubbleEmittedAt.delete(sessionId);
}

// TODO Story 6.5: Reaction peak detection
// Will call shouldEmitCaptureBubble() and markBubbleEmitted() from peak-detector service
// Peak detection logic: sustained reaction rate spike above session baseline
// Server-side detection ensures consistent triggering across all devices (FR73)
export function emitReactionPeakBubble(_sessionId: string): void {
  // Placeholder — implemented in Story 6.5
}
