import type { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedSocket } from '../shared/socket-types.js';
import { EVENTS } from '../shared/events.js';
import { getSessionDjState } from '../services/dj-state-store.js';
import { DJState } from '../dj-engine/types.js';
import { recordIcebreakerVote } from '../services/icebreaker-dealer.js';
import { recordParticipationAction } from '../services/session-manager.js';
import { appendEvent } from '../services/event-stream.js';
import { icebreakerVoteSchema } from '../shared/schemas/icebreaker-schemas.js';

export function registerIcebreakerHandlers(
  socket: AuthenticatedSocket,
  io: SocketIOServer,
): void {
  socket.on(EVENTS.ICEBREAKER_VOTE, (rawPayload: unknown) => {
    const parsed = icebreakerVoteSchema.safeParse(rawPayload);
    if (!parsed.success) return;
    const { sessionId, userId } = socket.data;
    if (!sessionId || !userId) return;

    // Guard: DJ state must be icebreaker
    const context = getSessionDjState(sessionId);
    if (!context || context.state !== DJState.icebreaker) return;

    const { recorded, firstVote } = recordIcebreakerVote(sessionId, userId, parsed.data.optionId);
    if (!recorded) return;

    // NO broadcast of individual votes — private input, public output

    if (firstVote) {
      recordParticipationAction(sessionId, userId, 'icebreaker:vote', 1).catch((err: unknown) => {
        console.warn('[icebreaker-handlers] participation scoring failed:', err);
      });
    }

    appendEvent(sessionId, {
      type: 'icebreaker:vote',
      ts: Date.now(),
      userId,
      data: { optionId: parsed.data.optionId },
    });
  });
}
