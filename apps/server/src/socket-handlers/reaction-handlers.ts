import type { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedSocket } from '../shared/socket-types.js';
import { EVENTS } from '../shared/events.js';
import { recordUserEvent, checkRateLimit } from '../services/rate-limiter.js';
import { recordParticipationAction } from '../services/session-manager.js';
import { getSessionDjState } from '../services/dj-state-store.js';
import { recordActivity } from '../services/activity-tracker.js';
import { DJState } from '../dj-engine/types.js';

export function registerReactionHandlers(socket: AuthenticatedSocket, io: SocketIOServer): void {
  socket.on(EVENTS.REACTION_SENT, async (data: { emoji: string }) => {
    const { sessionId, userId } = socket.data;
    if (!sessionId || !userId) return;
    if (typeof data?.emoji !== 'string') return;

    // State guard: reactions only during song state
    const context = getSessionDjState(sessionId);
    if (!context || context.state !== DJState.song) return;

    // Track session activity (matches party-handlers pattern)
    recordActivity(sessionId);

    // Rate limiting — pure function, no Socket.io dependency
    const now = Date.now();
    const timestamps = recordUserEvent(userId, now);
    const { rewardMultiplier } = checkRateLimit(timestamps, now);

    // Broadcast to ALL participants in session (including sender)
    io.to(sessionId).emit(EVENTS.REACTION_BROADCAST, {
      userId,
      emoji: data.emoji,
      rewardMultiplier,
    });

    // Participation scoring + event stream logging (fire-and-forget)
    // recordParticipationAction internally handles appendEvent for participation:scored
    // DO NOT call appendEvent separately — it would create duplicate events
    recordParticipationAction(sessionId, userId, 'reaction:sent', rewardMultiplier).catch(() => {});
  });
}
