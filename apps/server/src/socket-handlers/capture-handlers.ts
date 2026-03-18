import type { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedSocket } from '../shared/socket-types.js';
import { EVENTS } from '../shared/events.js';
import { appendEvent } from '../services/event-stream.js';
import { getSessionDjState } from '../services/dj-state-store.js';
import { persistCaptureMetadata } from '../services/capture-service.js';

const VALID_CAPTURE_TYPES = new Set(['photo', 'video', 'audio']);
const VALID_TRIGGER_TYPES = new Set(['session_start', 'reaction_peak', 'post_ceremony', 'session_end', 'manual']);

function isValidCapturePayload(data: unknown): data is { captureType: string; triggerType: string; durationMs?: number } {
  if (typeof data !== 'object' || data === null) return false;
  const d = data as Record<string, unknown>;
  return VALID_CAPTURE_TYPES.has(d.captureType as string) &&
    VALID_TRIGGER_TYPES.has(d.triggerType as string) &&
    (d.durationMs === undefined || typeof d.durationMs === 'number');
}

export function registerCaptureHandlers(socket: AuthenticatedSocket, _io: SocketIOServer): void {
  socket.on(EVENTS.CAPTURE_STARTED, (data: unknown) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;
    if (!isValidCapturePayload(data)) return;

    appendEvent(sessionId, {
      type: 'capture:started',
      ts: Date.now(),
      userId: socket.data.userId,
      data: {
        captureType: data.captureType as 'photo' | 'video' | 'audio',
        triggerType: data.triggerType,
      },
    });
  });

  socket.on(EVENTS.CAPTURE_COMPLETE, (data: unknown) => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;
    if (!isValidCapturePayload(data)) return;

    appendEvent(sessionId, {
      type: 'capture:complete',
      ts: Date.now(),
      userId: socket.data.userId,
      data: {
        captureType: data.captureType as 'photo' | 'video' | 'audio',
        triggerType: data.triggerType,
        durationMs: data.durationMs,
      },
    });

    // Fire-and-forget: persist capture metadata to DB
    const djState = getSessionDjState(sessionId);
    (async () => {
      const captureId = await persistCaptureMetadata({
        sessionId,
        userId: socket.data.userId ?? null,
        captureType: data.captureType,
        triggerType: data.triggerType,
        djStateAtCapture: djState ?? null,
      });
      if (captureId) {
        socket.emit(EVENTS.CAPTURE_PERSISTED, { captureId });
      }
    })();
  });

  socket.on(EVENTS.CAPTURE_SHARED, () => {
    const sessionId = socket.data.sessionId;
    if (!sessionId) return;

    appendEvent(sessionId, {
      type: 'capture:shared',
      ts: Date.now(),
      userId: socket.data.userId,
      data: {},
    });
  });
}
