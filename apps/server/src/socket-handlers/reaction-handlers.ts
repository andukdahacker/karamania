import type { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedSocket } from '../shared/socket-types.js';
import { EVENTS } from '../shared/events.js';
import { recordUserEvent, checkRateLimit } from '../services/rate-limiter.js';
import { recordParticipationAction } from '../services/session-manager.js';
import { getSessionDjState } from '../services/dj-state-store.js';
import { recordActivity } from '../services/activity-tracker.js';
import { DJState } from '../dj-engine/types.js';
import { recordReactionStreak } from '../services/streak-tracker.js';
import { appendEvent } from '../services/event-stream.js';

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

    // Streak tracking — counts ALL reactions regardless of rate limit (AC #5)
    const { streakCount, milestone } = recordReactionStreak(sessionId, userId, now);

    // Broadcast to ALL participants in session (including sender)
    io.to(sessionId).emit(EVENTS.REACTION_BROADCAST, {
      userId,
      emoji: data.emoji,
      rewardMultiplier,
    });

    // Milestone notification — to reacting user ONLY (AC #1)
    if (milestone !== null) {
      socket.emit(EVENTS.REACTION_STREAK, {
        streakCount: milestone,
        emoji: data.emoji,
        displayName: socket.data.displayName,
      });
    }

    // Participation scoring (fire-and-forget)
    // recordParticipationAction internally handles appendEvent for participation:scored
    recordParticipationAction(sessionId, userId, 'reaction:sent', rewardMultiplier).catch(() => {});

    // Log reaction to event stream (architecture schema: reaction:sent includes streak)
    appendEvent(sessionId, {
      type: 'reaction:sent',
      ts: now,
      userId,
      data: { emoji: data.emoji, streak: streakCount },
    });
  });
}
