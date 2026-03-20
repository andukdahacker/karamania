import type { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedSocket } from '../shared/socket-types.js';
import { EVENTS } from '../shared/events.js';
import { feedbackPayloadSchema } from '../shared/schemas/finale-schemas.js';
import { saveFeedback } from '../services/session-manager.js';

// Track which users have submitted feedback per session (rate limit: one per user per session)
const feedbackSubmitted = new Map<string, Set<string>>();

export function registerFinaleHandlers(socket: AuthenticatedSocket, _io: SocketIOServer): void {
  socket.on(EVENTS.FINALE_FEEDBACK, async (data: unknown) => {
    try {
      const { sessionId, userId } = socket.data;

      // Validate payload using Zod schema
      const parsed = feedbackPayloadSchema.safeParse(data);
      if (!parsed.success) return;
      const { score } = parsed.data;

      // Rate limit: one feedback per user per session
      const sessionFeedback = feedbackSubmitted.get(sessionId) ?? new Set<string>();
      if (sessionFeedback.has(userId)) return; // Ignore duplicate silently
      sessionFeedback.add(userId);
      feedbackSubmitted.set(sessionId, sessionFeedback);

      await saveFeedback(sessionId, userId, score);
    } catch (error) {
      console.error('[finale-handlers] finale:feedback error:', error);
    }
  });
}

export function clearFeedbackTracking(sessionId: string): void {
  feedbackSubmitted.delete(sessionId);
}
