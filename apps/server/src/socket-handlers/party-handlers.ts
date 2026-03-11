import type { AuthenticatedSocket } from '../shared/socket-types.js';
import { EVENTS } from '../shared/events.js';
import { VALID_VIBES } from '../shared/constants.js';
import { updateVibe } from '../persistence/session-repository.js';
import { startSession } from '../services/session-manager.js';
import { broadcastDjState } from '../services/dj-broadcaster.js';
import { recordActivity } from '../services/activity-tracker.js';

export function registerPartyHandlers(socket: AuthenticatedSocket): void {
  socket.on(EVENTS.PARTY_VIBE_CHANGED, async (data: { vibe: string }) => {
    if (!(VALID_VIBES as readonly string[]).includes(data.vibe)) return;
    recordActivity(socket.data.sessionId);
    await updateVibe(socket.data.sessionId, data.vibe);
    socket.to(socket.data.sessionId).emit(EVENTS.PARTY_VIBE_CHANGED, { vibe: data.vibe });
  });

  socket.on(EVENTS.PARTY_START, async () => {
    try {
      recordActivity(socket.data.sessionId);
      const { djContext } = await startSession({
        sessionId: socket.data.sessionId,
        hostUserId: socket.data.userId,
      });

      const payload = { status: 'active' };
      socket.emit(EVENTS.PARTY_STARTED, payload);
      socket.to(socket.data.sessionId).emit(EVENTS.PARTY_STARTED, payload);

      broadcastDjState(socket.data.sessionId, djContext);
    } catch {
      // Silently fail — button is disabled when conditions aren't met
    }
  });
}
