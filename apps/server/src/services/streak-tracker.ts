interface StreakState {
  count: number;
  lastReactionAt: number;
}

// In-memory streak store: Map<`${sessionId}:${userId}`, StreakState>
const streakStore = new Map<string, StreakState>();

const STREAK_MILESTONES = [5, 10, 20, 50] as const;
const INACTIVITY_RESET_MS = 5000;

export function recordReactionStreak(
  sessionId: string,
  userId: string,
  now: number
): { streakCount: number; milestone: number | null } {
  const key = `${sessionId}:${userId}`;
  const current = streakStore.get(key);

  // Reset if inactivity gap > 5s
  if (current && now - current.lastReactionAt > INACTIVITY_RESET_MS) {
    streakStore.set(key, { count: 1, lastReactionAt: now });
    return { streakCount: 1, milestone: null };
  }

  const newCount = (current?.count ?? 0) + 1;
  streakStore.set(key, { count: newCount, lastReactionAt: now });

  const milestone = STREAK_MILESTONES.includes(newCount as typeof STREAK_MILESTONES[number])
    ? newCount
    : null;

  return { streakCount: newCount, milestone };
}

export function clearSessionStreaks(sessionId: string): void {
  const prefix = `${sessionId}:`;
  const keysToDelete = [...streakStore.keys()].filter(k => k.startsWith(prefix));
  keysToDelete.forEach(k => streakStore.delete(k));
}

export function clearUserStreak(sessionId: string, userId: string): void {
  streakStore.delete(`${sessionId}:${userId}`);
}

export function clearStreakStore(): void {
  streakStore.clear();
}
