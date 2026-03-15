import type { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedSocket } from '../shared/socket-types.js';
import { EVENTS } from '../shared/events.js';
import { getSessionDjState } from '../services/dj-state-store.js';
import { DJState } from '../dj-engine/types.js';
import { checkRateLimit, recordUserEvent } from '../services/rate-limiter.js';
import { recordParticipationAction } from '../services/session-manager.js';
import { recordActivity } from '../services/activity-tracker.js';
import { appendEvent } from '../services/event-stream.js';

const HYPE_COOLDOWN_MS = 5000;
const lastHypeTime = new Map<string, number>();

export function registerLightstickHandlers(
  socket: AuthenticatedSocket,
  io: SocketIOServer
): void {
  socket.on(EVENTS.LIGHTSTICK_TOGGLED, async (data: { active: boolean }) => {
    const { sessionId, userId } = socket.data;
    if (!sessionId || !userId) return;
    if (typeof data?.active !== 'boolean') return;

    // State guard: only during song state
    const context = getSessionDjState(sessionId);
    if (!context || context.state !== DJState.song) return;

    recordActivity(sessionId);

    // Only score when entering lightstick mode (active=true)
    if (data.active) {
      const now = Date.now();
      const timestamps = recordUserEvent(userId, now);
      const { rewardMultiplier } = checkRateLimit(timestamps, now);
      recordParticipationAction(sessionId, userId, 'lightstick:toggled', rewardMultiplier).catch(() => {});
    }

    // Log to event stream — NO broadcast (mode selection is private)
    appendEvent(sessionId, {
      type: 'lightstick:toggled',
      ts: Date.now(),
      userId,
      data: { active: data.active },
    });
  });

  socket.on(EVENTS.HYPE_FIRED, async () => {
    const { sessionId, userId } = socket.data;
    if (!sessionId || !userId) return;

    // State guard: only during song state
    const context = getSessionDjState(sessionId);
    if (!context || context.state !== DJState.song) return;

    // Dedicated per-user cooldown (NOT shared rate limiter), scoped by session
    const now = Date.now();
    const cooldownKey = `${sessionId}:${userId}`;
    const lastTime = lastHypeTime.get(cooldownKey);
    if (lastTime !== undefined) {
      const elapsed = now - lastTime;
      if (elapsed < HYPE_COOLDOWN_MS) {
        socket.emit(EVENTS.HYPE_COOLDOWN, { remainingMs: HYPE_COOLDOWN_MS - elapsed });
        return;
      }
    }
    lastHypeTime.set(cooldownKey, now);

    recordActivity(sessionId);

    // Participation scoring — active tier (3pts)
    recordParticipationAction(sessionId, userId, 'hype:fired', 1.0).catch(() => {});

    // Log to event stream — NO broadcast (hype is local experience)
    appendEvent(sessionId, {
      type: 'hype:fired',
      ts: now,
      userId,
      data: {},
    });
  });

  // Clean up hype cooldown on disconnect
  socket.on('disconnect', () => {
    const { sessionId: sid, userId: uid } = socket.data;
    if (sid && uid) {
      lastHypeTime.delete(`${sid}:${uid}`);
    }
  });
}

// Exported for testing
export { lastHypeTime, HYPE_COOLDOWN_MS };
