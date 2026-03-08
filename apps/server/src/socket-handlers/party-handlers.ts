import type { AuthenticatedSocket } from '../shared/socket-types.js';
import { EVENTS } from '../shared/events.js';
import { VALID_VIBES } from '../shared/constants.js';
import { updateVibe } from '../persistence/session-repository.js';

// Architecture pattern: registerXHandlers(socket, session)
// TODO: Add session: SessionState parameter when session-manager exists (Story 1.6+)
export function registerPartyHandlers(socket: AuthenticatedSocket): void {
  socket.on(EVENTS.PARTY_VIBE_CHANGED, async (data: { vibe: string }) => {
    if (!(VALID_VIBES as readonly string[]).includes(data.vibe)) return;
    await updateVibe(socket.data.sessionId, data.vibe);
    socket.to(socket.data.sessionId).emit(EVENTS.PARTY_VIBE_CHANGED, { vibe: data.vibe });
  });
}
