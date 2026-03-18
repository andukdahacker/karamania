import type { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedSocket } from '../shared/socket-types.js';
import { EVENTS } from '../shared/events.js';
import { getSessionDjState } from '../services/dj-state-store.js';
import { DJState } from '../dj-engine/types.js';
import { recordVote, getRound } from '../services/activity-voter.js';
import { recordParticipationAction, handleInterludeVoteWinner } from '../services/session-manager.js';
import { appendEvent } from '../services/event-stream.js';
import { activityVoteSchema, quickVoteCastSchema } from '../shared/schemas/interlude-schemas.js';
import { recordQuickVote } from '../services/quick-vote-dealer.js';

export function registerInterludeHandlers(
  socket: AuthenticatedSocket,
  io: SocketIOServer,
): void {
  socket.on(EVENTS.INTERLUDE_VOTE, (rawPayload: unknown) => {
    const parsed = activityVoteSchema.safeParse(rawPayload);
    if (!parsed.success) return;
    const payload = parsed.data;
    const { sessionId, userId, displayName } = socket.data;
    if (!sessionId || !userId) return;

    // Guard: DJ state must be interlude
    const context = getSessionDjState(sessionId);
    if (!context || context.state !== DJState.interlude) return;

    // Guard: round must exist
    const round = getRound(sessionId);
    if (!round) return;

    // Record vote
    const { recorded, voteCounts, winner } = recordVote(sessionId, userId, payload.optionId);
    if (!recorded) return;

    // Broadcast vote update to all participants
    io.to(sessionId).emit(EVENTS.INTERLUDE_VOTE, {
      optionId: payload.optionId,
      userId,
      displayName,
      voteCounts,
    });

    // If majority winner — resolve early
    if (winner) {
      handleInterludeVoteWinner(sessionId, winner);
    }

    // Record participation (fire-and-forget)
    recordParticipationAction(sessionId, userId, 'interlude:vote', 1).catch((err: unknown) => {
      console.warn('[interlude-handlers] participation scoring failed:', err);
    });

    // Append event
    appendEvent(sessionId, {
      type: 'interlude:vote',
      ts: Date.now(),
      userId,
      data: { optionId: payload.optionId },
    });
  });

  socket.on(EVENTS.QUICK_VOTE_CAST, (rawPayload: unknown) => {
    const parsed = quickVoteCastSchema.safeParse(rawPayload);
    if (!parsed.success) return;
    const payload = parsed.data;
    const { sessionId, userId } = socket.data;
    if (!sessionId || !userId) return;

    // Guard: DJ state must be interlude
    const context = getSessionDjState(sessionId);
    if (!context || context.state !== DJState.interlude) return;

    // Record vote (idempotent — last vote wins)
    const { recorded, firstVote } = recordQuickVote(sessionId, userId, payload.option);
    if (!recorded) return;

    // Record participation only on first vote — prevent point farming by toggling A/B
    if (firstVote) {
      recordParticipationAction(sessionId, userId, 'interlude:vote', 1).catch((err: unknown) => {
        console.warn('[interlude-handlers] quick vote participation scoring failed:', err);
      });
    }

    // Append event — NO broadcast of individual votes (private input, public output)
    appendEvent(sessionId, {
      type: 'interlude:quickVoteCast',
      ts: Date.now(),
      userId,
      data: { option: payload.option },
    });
  });
}
