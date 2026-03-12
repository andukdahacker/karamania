export function checkRateLimit(
  events: number[],
  now: number,
  windowMs: number = 5000,
  maxEvents: number = 10,
  inactivityResetMs: number = 5000
): { allowed: boolean; rewardMultiplier: number } {
  // 5s inactivity reset: if last event was >inactivityResetMs ago, treat as fresh
  if (events.length > 0 && now - events[events.length - 1]! > inactivityResetMs) {
    return { allowed: true, rewardMultiplier: 1.0 };
  }

  const windowEvents = events.filter(t => now - t < windowMs);
  if (windowEvents.length < maxEvents) {
    return { allowed: true, rewardMultiplier: 1.0 };
  }
  if (windowEvents.length < maxEvents * 2) {
    const overage = windowEvents.length - maxEvents;
    return { allowed: true, rewardMultiplier: Math.pow(0.5, overage) };
  }
  return { allowed: true, rewardMultiplier: 0 };
}

// In-memory rate limit store
const userEventTimestamps = new Map<string, number[]>();

export function recordUserEvent(userId: string, now: number, windowMs: number = 30000): number[] {
  let timestamps = userEventTimestamps.get(userId);
  if (!timestamps) {
    timestamps = [];
    userEventTimestamps.set(userId, timestamps);
  }
  timestamps.push(now);
  // Prune timestamps older than 2x window to prevent unbounded growth
  const cutoff = now - windowMs * 2;
  const firstValid = timestamps.findIndex(t => t >= cutoff);
  if (firstValid > 0) {
    timestamps.splice(0, firstValid);
  }
  return timestamps;
}

export function cleanupStaleTimestamps(windowMs: number = 30000): void {
  const now = Date.now();
  for (const [userId, timestamps] of userEventTimestamps) {
    const fresh = timestamps.filter(t => now - t < windowMs);
    if (fresh.length === 0) {
      userEventTimestamps.delete(userId);
    } else {
      userEventTimestamps.set(userId, fresh);
    }
  }
}

export function clearRateLimitStore(): void {
  userEventTimestamps.clear();
}
