import type { Server as SocketIOServer } from 'socket.io';
import type { AuthenticatedSocket } from '../shared/socket-types.js';
import { EVENTS } from '../shared/events.js';
import { tvPairSchema } from '../shared/schemas/tv-schemas.js';
import { pairTv, unpairTv } from '../services/session-manager.js';
import { appendEvent } from '../services/event-stream.js';

export function registerTvHandlers(socket: AuthenticatedSocket, io: SocketIOServer): void {
  socket.on(EVENTS.TV_PAIR, async (rawPayload: unknown) => {
    const { sessionId, userId, role } = socket.data;
    if (!sessionId || !userId) return;
    if (role !== 'host') return;

    const parsed = tvPairSchema.safeParse(rawPayload);
    if (!parsed.success) return;

    try {
      await pairTv(sessionId, parsed.data.pairingCode);
      io.to(sessionId).emit(EVENTS.TV_STATUS, { status: 'connected' });
      appendEvent(sessionId, { type: 'tv:paired', ts: Date.now(), userId });
    } catch (error) {
      socket.emit(EVENTS.TV_STATUS, {
        status: 'disconnected',
        message: (error as Error).message,
      });
    }
  });

  socket.on(EVENTS.TV_UNPAIR, async () => {
    const { sessionId, userId, role } = socket.data;
    if (!sessionId || !userId) return;
    if (role !== 'host') return;

    try {
      await unpairTv(sessionId);
    } catch {
      // Disconnect is best-effort
    }
    io.to(sessionId).emit(EVENTS.TV_STATUS, { status: 'disconnected' });
    appendEvent(sessionId, { type: 'tv:unpaired', ts: Date.now(), userId });
  });
}
