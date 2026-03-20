import type { AuthenticatedSocket } from '../shared/socket-types.js';
import { verifyFirebaseToken } from '../integrations/firebase-admin.js';
import { findByFirebaseUid } from '../persistence/user-repository.js';
import { EVENTS } from '../shared/events.js';

export function registerAuthUpgradeHandler(socket: AuthenticatedSocket): void {
  socket.on(EVENTS.AUTH_UPGRADED, async (payload: { firebaseToken: string }) => {
    try {
      const decoded = await verifyFirebaseToken(payload.firebaseToken);
      const user = await findByFirebaseUid(decoded.uid);

      if (!user) {
        return; // Silently fail — REST already persisted, this is best-effort
      }

      // Update socket.data in-place — NO disconnect
      socket.data.userId = user.id;
      socket.data.role = 'authenticated';
      socket.data.displayName = user.display_name;
    } catch {
      // Silently fail — REST already persisted everything
    }
  });
}
