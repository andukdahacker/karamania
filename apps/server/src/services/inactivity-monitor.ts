// Inactivity monitor — auto-pauses sessions after 90s of no activity
// Checks all active sessions periodically

import { getAllActiveSessions } from '../services/dj-state-store.js';
import { getLastActivity } from '../services/activity-tracker.js';
import { pauseSession } from '../services/session-manager.js';

export const INACTIVITY_THRESHOLD_MS = 90_000;
export const CHECK_INTERVAL_MS = 15_000;

let intervalHandle: NodeJS.Timeout | null = null;

export function startInactivityMonitor(): void {
  stopInactivityMonitor();

  intervalHandle = setInterval(() => {
    void checkInactivity();
  }, CHECK_INTERVAL_MS);
}

export function stopInactivityMonitor(): void {
  if (intervalHandle) {
    clearInterval(intervalHandle);
    intervalHandle = null;
  }
}

async function checkInactivity(): Promise<void> {
  const now = Date.now();
  const sessions = getAllActiveSessions();

  for (const { sessionId, context } of sessions) {
    if (context.isPaused) continue;
    if (context.state === 'lobby' || context.state === 'finale') continue;

    const lastActivity = getLastActivity(sessionId);
    if (lastActivity === undefined) continue;

    if (now - lastActivity >= INACTIVITY_THRESHOLD_MS) {
      try {
        await pauseSession(sessionId);
        // Log auto-pause (console.warn for visibility in structured logs)
        console.warn(`[inactivity-monitor] Auto-pausing session ${sessionId} due to inactivity`);
      } catch {
        // Session may have ended or already been paused — ignore
      }
    }
  }
}
