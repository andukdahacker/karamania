import type { Server as SocketIOServer } from 'socket.io';
import type { DJContext } from '../dj-engine/types.js';
import { EVENTS } from '../shared/events.js';

let io: SocketIOServer | null = null;

export function initDjBroadcaster(ioServer: SocketIOServer): void {
  io = ioServer;
}

export function buildDjStatePayload(context: DJContext): {
  state: string;
  sessionId: string;
  songCount: number;
  participantCount: number;
  currentPerformer: string | null;
  timerStartedAt: number | null;
  timerDurationMs: number | null;
} {
  return {
    state: context.state,
    sessionId: context.sessionId,
    songCount: context.songCount,
    participantCount: context.participantCount,
    currentPerformer: context.currentPerformer,
    timerStartedAt: context.timerStartedAt,
    timerDurationMs: context.timerDurationMs,
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
