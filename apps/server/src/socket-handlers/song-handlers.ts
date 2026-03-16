import type { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedSocket } from '../shared/socket-types.js';
import { EVENTS } from '../shared/events.js';
import { getSessionDjState } from '../services/dj-state-store.js';
import { DJState } from '../dj-engine/types.js';
import { recordVote, getRound } from '../services/quick-pick.js';
import { handleQuickPickSongSelected, recordParticipationAction } from '../services/session-manager.js';
import { appendEvent } from '../services/event-stream.js';
import { quickPickVoteSchema } from '../shared/schemas/quick-pick-schemas.js';

export function registerSongHandlers(
  socket: AuthenticatedSocket,
  io: SocketIOServer,
): void {
  socket.on(EVENTS.SONG_QUICKPICK, async (rawPayload: unknown) => {
    const parsed = quickPickVoteSchema.safeParse(rawPayload);
    if (!parsed.success) return;
    const payload = parsed.data;
    const { sessionId, userId, displayName } = socket.data;
    if (!sessionId || !userId) return;

    // Guard: DJ state must be songSelection
    const context = getSessionDjState(sessionId);
    if (!context || context.state !== DJState.songSelection) return;

    // Guard: round must exist
    const round = getRound(sessionId);
    if (!round) return;

    // Guard: catalogTrackId must be in the round
    if (!round.votes.has(payload.catalogTrackId)) return;

    // Record vote
    const { recorded, songVotes, winner } = recordVote(
      sessionId,
      userId,
      payload.catalogTrackId,
      payload.vote,
    );
    if (!recorded) return;

    // Broadcast vote update to all participants
    io.to(sessionId).emit(EVENTS.SONG_QUICKPICK, {
      catalogTrackId: payload.catalogTrackId,
      userId,
      displayName,
      vote: payload.vote,
      songVotes,
    });

    // If majority winner — select the song
    if (winner) {
      await handleQuickPickSongSelected(sessionId, winner);
    }

    // Record participation (fire-and-forget)
    recordParticipationAction(sessionId, userId, 'quickpick:vote', 1).catch(() => {});

    // Append event
    appendEvent(sessionId, {
      type: 'quickpick:vote',
      ts: Date.now(),
      userId,
      data: { catalogTrackId: payload.catalogTrackId, vote: payload.vote },
    });
  });
}
