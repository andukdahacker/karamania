// Timer scheduler — manages setTimeout/clearTimeout for DJ state timers
// No dj-engine imports — callbacks provided by caller (session-manager)

const timers = new Map<string, NodeJS.Timeout>();

export function scheduleSessionTimer(
  sessionId: string,
  durationMs: number,
  onTimeout: () => void,
): void {
  // Clear existing timer for this session
  cancelSessionTimer(sessionId);

  const timer = setTimeout(() => {
    timers.delete(sessionId);
    onTimeout();
  }, durationMs);

  timers.set(sessionId, timer);
}

export function cancelSessionTimer(sessionId: string): void {
  const timer = timers.get(sessionId);
  if (timer) {
    clearTimeout(timer);
    timers.delete(sessionId);
  }
}

export function getActiveTimer(sessionId: string): boolean {
  return timers.has(sessionId);
}

export function clearAllTimers(): void {
  for (const timer of timers.values()) {
    clearTimeout(timer);
  }
  timers.clear();
}
