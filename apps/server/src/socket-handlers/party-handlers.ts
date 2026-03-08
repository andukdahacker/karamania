import type { AuthenticatedSocket } from '../shared/socket-types.js';

// Architecture pattern: registerXHandlers(socket, session)
// session parameter is the in-memory SessionState — created in Story 1.6+
// For now, accept socket only; add session param when session-manager exists
export function registerPartyHandlers(socket: AuthenticatedSocket): void {
  // TODO: Implement party events in Story 1.4+
  // TODO: Add session: SessionState parameter when session-manager exists (Story 1.6+)
  // Pattern: socket.on(EVENTS.PARTY_JOINED, async (data) => { ... });
  void socket;
}
