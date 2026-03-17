import type { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedSocket } from '../shared/socket-types.js';
import { EVENTS } from '../shared/events.js';
import { getSessionDjState } from '../services/dj-state-store.js';
import { DJState } from '../dj-engine/types.js';
import { recordVote, getRound } from '../services/quick-pick.js';
import { handleQuickPickSongSelected, recordParticipationAction, getSongSelectionMode, handleModeChange, handleSpinAnimationComplete, handleManualSongPlay } from '../services/session-manager.js';
import { appendEvent } from '../services/event-stream.js';
import { quickPickVoteSchema } from '../shared/schemas/quick-pick-schemas.js';
import { spinWheelActionSchema, songModeSchema } from '../shared/schemas/spin-wheel-schemas.js';
import { songManualPlaySchema } from '../shared/schemas/tv-schemas.js';
import { validateHost } from './host-handlers.js';
import { initiateSpin, getRound as getSpinWheelRound, handleVeto } from '../services/spin-wheel.js';
import { broadcastSpinWheelResult } from '../services/dj-broadcaster.js';
import { cancelSessionTimer } from '../services/timer-scheduler.js';

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

  // Spin the Wheel handler
  socket.on(EVENTS.SONG_SPINWHEEL, async (rawPayload: unknown) => {
    const parsed = spinWheelActionSchema.safeParse(rawPayload);
    if (!parsed.success) return;
    const payload = parsed.data;
    const { sessionId, userId, displayName } = socket.data;
    if (!sessionId || !userId) return;

    // Guard: DJ state must be songSelection
    const context = getSessionDjState(sessionId);
    if (!context || context.state !== DJState.songSelection) return;

    // Guard: mode must be spinWheel
    if (getSongSelectionMode(sessionId) !== 'spinWheel') return;

    // Guard: round must exist
    const round = getSpinWheelRound(sessionId);
    if (!round) return;

    if (payload.action === 'spin') {
      const spinResult = initiateSpin(sessionId, userId);
      if (!spinResult) return; // already spinning

      // CRITICAL: cancel DJ engine's 15s timeout to prevent overlap
      cancelSessionTimer(sessionId);

      broadcastSpinWheelResult(sessionId, {
        phase: 'spinning',
        spinnerUserId: userId,
        spinnerDisplayName: displayName,
        targetSegmentIndex: spinResult.targetSegmentIndex,
        totalRotationRadians: spinResult.totalRotationRadians,
        spinDurationMs: spinResult.spinDurationMs,
      });

      // Schedule spin animation completion
      const spinTimer = setTimeout(() => {
        void handleSpinAnimationComplete(sessionId);
      }, spinResult.spinDurationMs);
      round.spinTimerHandle = spinTimer;

      recordParticipationAction(sessionId, userId, 'spinwheel:spin', 2).catch(() => {});
      appendEvent(sessionId, {
        type: 'spinwheel:spin',
        ts: Date.now(),
        userId,
      });
    } else if (payload.action === 'veto') {
      const vetoResult = handleVeto(sessionId, userId);
      if (!vetoResult) return; // veto already used or wrong state

      // Cancel veto window timer before scheduling re-spin
      if (round.vetoTimerHandle) clearTimeout(round.vetoTimerHandle);

      broadcastSpinWheelResult(sessionId, {
        phase: 'vetoed',
        vetoUserId: userId,
        vetoDisplayName: displayName,
        vetoedSong: vetoResult.vetoedSong,
        newTargetSegmentIndex: vetoResult.newTargetSegmentIndex,
        totalRotationRadians: vetoResult.totalRotationRadians,
        spinDurationMs: vetoResult.spinDurationMs,
      });

      // Schedule new spin completion
      const spinTimer = setTimeout(() => {
        void handleSpinAnimationComplete(sessionId);
      }, vetoResult.spinDurationMs);
      round.spinTimerHandle = spinTimer;

      recordParticipationAction(sessionId, userId, 'spinwheel:veto', 1).catch(() => {});
      appendEvent(sessionId, {
        type: 'spinwheel:veto',
        ts: Date.now(),
        userId,
        data: { vetoedSong: vetoResult.vetoedSong.songTitle },
      });
    }
  });

  // Song mode change handler
  socket.on(EVENTS.SONG_MODE_CHANGED, async (rawPayload: unknown) => {
    const parsed = songModeSchema.safeParse(rawPayload);
    if (!parsed.success) return;
    const { sessionId, userId, displayName } = socket.data;
    if (!sessionId || !userId) return;

    await handleModeChange(sessionId, parsed.data.mode, userId, displayName ?? 'Unknown');
  });

  // Manual song play handler (suggestion-only mode)
  socket.on(EVENTS.SONG_MANUAL_PLAY, async (data: unknown) => {
    try {
      const { sessionId } = socket.data;
      if (!sessionId) return;
      await validateHost(socket);
      const parsed = songManualPlaySchema.parse(data);
      await handleManualSongPlay(sessionId, parsed);
    } catch (error) {
      if (!(error instanceof Error && error.message === 'Not host')) {
        console.error('[song-handlers] song:manualPlay error:', error);
      }
    }
  });
}
