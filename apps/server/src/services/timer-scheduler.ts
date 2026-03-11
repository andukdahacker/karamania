// Timer scheduler — manages setTimeout/clearTimeout for DJ state timers
// No dj-engine imports — callbacks provided by caller (session-manager)

const timers = new Map<string, NodeJS.Timeout>();
const timerMeta = new Map<string, { startedAt: number; durationMs: number }>();

export function scheduleSessionTimer(
  sessionId: string,
  durationMs: number,
  onTimeout: () => void,
): void {
  // Clear existing timer for this session
  cancelSessionTimer(sessionId);

  const timer = setTimeout(() => {
    timers.delete(sessionId);
    timerMeta.delete(sessionId);
    onTimeout();
  }, durationMs);

  timers.set(sessionId, timer);
  timerMeta.set(sessionId, { startedAt: Date.now(), durationMs });
}

export function cancelSessionTimer(sessionId: string): void {
  const timer = timers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(sessionId);
  }
  timerMeta.delete(sessionId);
}

export function pauseSessionTimer(sessionId: string): number | null {
  const meta = timerMeta.get(sessionId);
  if (!meta) {
    return null;
  }

  const elapsed = Date.now() - meta.startedAt;
  const remaining = Math.max(0, meta.durationMs - elapsed);

  cancelSessionTimer(sessionId);

  return remaining;
}

export function resumeSessionTimer(
  sessionId: string,
  remainingMs: number,
  onTimeout: () => void,
): void {
  scheduleSessionTimer(sessionId, remainingMs, onTimeout);
}

export function getActiveTimer(sessionId: string): boolean {
  return timers.has(sessionId);
}

export function clearAllTimers(): void {
  for (const timer of timers.values()) {
    clearTimeout(timer);
  }
  timers.clear();
  timerMeta.clear();
}
