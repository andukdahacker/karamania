import type { AuthenticatedSocket } from '../shared/socket-types.js';
import { EVENTS } from '../shared/events.js';
import { VALID_VIBES } from '../shared/constants.js';
import { updateVibe } from '../persistence/session-repository.js';
import { startSession } from '../services/session-manager.js';

export function registerPartyHandlers(socket: AuthenticatedSocket): void {
  socket.on(EVENTS.PARTY_VIBE_CHANGED, async (data: { vibe: string }) => {
    if (!(VALID_VIBES as readonly string[]).includes(data.vibe)) return;
    await updateVibe(socket.data.sessionId, data.vibe);
    socket.to(socket.data.sessionId).emit(EVENTS.PARTY_VIBE_CHANGED, { vibe: data.vibe });
  });

  socket.on(EVENTS.PARTY_START, async () => {
    try {
      await startSession({
        sessionId: socket.data.sessionId,
        hostUserId: socket.data.userId,
      });

      const payload = { status: 'active' };
      socket.emit(EVENTS.PARTY_STARTED, payload);
      socket.to(socket.data.sessionId).emit(EVENTS.PARTY_STARTED, payload);
    } catch {
      // Silently fail — button is disabled when conditions aren't met
    }
  });
}
