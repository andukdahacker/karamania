import type { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedSocket } from '../shared/socket-types.js';
import { EVENTS } from '../shared/events.js';

interface DetectResultPayload {
  title: string;
  artist: string;
  isrc?: string | null;
  timeOffsetMs?: number | null;
  confidence: number;
}

export function registerDetectionHandlers(socket: AuthenticatedSocket, io: SocketIOServer): void {
  socket.on(EVENTS.DETECT_RESULT, (payload: DetectResultPayload) => {
    // Validate required fields from client before broadcasting
    if (
      typeof payload?.title !== 'string' ||
      typeof payload?.artist !== 'string' ||
      typeof payload?.confidence !== 'number'
    ) {
      return;
    }

    const { sessionId, userId, displayName } = socket.data;

    // PoC logging for data collection
    console.log(`[detect] ${displayName} (${userId}) in session ${sessionId}: ${payload.title} by ${payload.artist} (confidence: ${payload.confidence})`);

    // Broadcast detect:songChanged to all session participants
    io.to(sessionId).emit(EVENTS.DETECT_SONG_CHANGED, {
      title: payload.title,
      artist: payload.artist,
      isrc: payload.isrc ?? null,
      timeOffsetMs: payload.timeOffsetMs ?? null,
      confidence: payload.confidence,
      detectedBy: userId,
    });
  });
}
