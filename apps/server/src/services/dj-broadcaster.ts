import type { Server as SocketIOServer } from 'socket.io';
import type { DJContext } from '../dj-engine/types.js';
import { DJState } from '../dj-engine/types.js';
import { EVENTS } from '../shared/events.js';

let io: SocketIOServer | null = null;

export function initDjBroadcaster(ioServer: SocketIOServer): void {
  io = ioServer;
}

export function getIO(): SocketIOServer | null {
  return io;
}

export function buildDjStatePayload(context: DJContext): {
  state: string;
  sessionId: string;
  songCount: number;
  participantCount: number;
  currentPerformer: string | null;
  timerStartedAt: number | null;
  timerDurationMs: number | null;
  isPaused: boolean;
  pausedFromState: string | null;
  timerRemainingMs: number | null;
  ceremonyType: string | null;
} {
  return {
    state: context.state,
    sessionId: context.sessionId,
    songCount: context.songCount,
    participantCount: context.participantCount,
    currentPerformer: context.currentPerformer,
    timerStartedAt: context.timerStartedAt,
    timerDurationMs: context.timerDurationMs,
    isPaused: context.isPaused,
    pausedFromState: context.pausedFromState,
    timerRemainingMs: context.timerRemainingMs,
    ceremonyType: context.state === DJState.ceremony
      ? (context.metadata.ceremonyType as string | undefined) ?? null
      : null,
  };
}

export function broadcastDjState(sessionId: string, context: DJContext): void {
  if (!io) {
    console.warn('[dj-broadcaster] Cannot broadcast — io not initialized');
    return;
  }
  const payload = buildDjStatePayload(context);
  io.to(sessionId).emit(EVENTS.DJ_STATE_CHANGED, payload);
}

export function broadcastDjPause(sessionId: string, context: DJContext): void {
  if (!io) {
    console.warn('[dj-broadcaster] Cannot broadcast — io not initialized');
    return;
  }
  io.to(sessionId).emit(EVENTS.DJ_PAUSE, {
    isPaused: true,
    pausedFromState: context.pausedFromState,
    timerRemainingMs: context.timerRemainingMs,
  });
}

export function broadcastDjResume(sessionId: string, context: DJContext): void {
  if (!io) {
    console.warn('[dj-broadcaster] Cannot broadcast — io not initialized');
    return;
  }
  const payload = buildDjStatePayload(context);
  io.to(sessionId).emit(EVENTS.DJ_RESUME, payload);
}

export function broadcastCeremonyAnticipation(
  sessionId: string,
  data: {
    performerName: string | null;
    revealAt: number;
  },
): void {
  if (!io) {
    console.warn('[dj-broadcaster] Cannot broadcast — io not initialized');
    return;
  }
  io.to(sessionId).emit(EVENTS.CEREMONY_ANTICIPATION, data);
}

export function broadcastCeremonyReveal(
  sessionId: string,
  data: {
    award: string;
    performerName: string | null;
    tone: string;
    songTitle: string | null;
  },
): void {
  if (!io) {
    console.warn('[dj-broadcaster] Cannot broadcast — io not initialized');
    return;
  }
  io.to(sessionId).emit(EVENTS.CEREMONY_REVEAL, data);
}

export function broadcastCeremonyQuick(
  sessionId: string,
  data: {
    award: string;
    performerName: string | null;
    tone: string;
  },
): void {
  if (!io) {
    console.warn('[dj-broadcaster] Cannot broadcast — io not initialized');
    return;
  }
  io.to(sessionId).emit(EVENTS.CEREMONY_QUICK, data);
}

export function broadcastQuickPickStarted(
  sessionId: string,
  data: {
    songs: Array<{
      catalogTrackId: string;
      songTitle: string;
      artist: string;
      youtubeVideoId: string;
      overlapCount: number;
    }>;
    participantCount: number;
    timerDurationMs: number;
  },
): void {
  if (!io) {
    console.warn('[dj-broadcaster] Cannot broadcast — io not initialized');
    return;
  }
  io.to(sessionId).emit(EVENTS.QUICKPICK_STARTED, data);
}

export function broadcastCardDealt(
  sessionId: string,
  data: {
    cardId: string;
    title: string;
    description: string;
    cardType: string;
    emoji: string;
  },
): void {
  if (!io) {
    console.warn('[dj-broadcaster] Cannot broadcast — io not initialized');
    return;
  }
  io.to(sessionId).emit(EVENTS.CARD_DEALT, data);
}
