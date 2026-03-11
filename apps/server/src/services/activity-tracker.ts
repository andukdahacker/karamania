// Activity tracker — maps sessionId to last activity timestamp
// Pure in-memory map, ZERO external imports

const activityMap = new Map<string, number>();

export function recordActivity(sessionId: string): void {
  activityMap.set(sessionId, Date.now());
}

export function getLastActivity(sessionId: string): number | undefined {
  return activityMap.get(sessionId);
}

export function removeSession(sessionId: string): void {
  activityMap.delete(sessionId);
}

export function clearAll(): void {
  activityMap.clear();
}
