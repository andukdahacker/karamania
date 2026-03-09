// In-memory connection tracking for disconnect/reconnect detection.
// Module-level singleton — same pattern as rate-limiter.
// BOUNDARY: ZERO imports from persistence/, db/, or integrations/.

interface TrackedConnection {
  socketId: string;
  userId: string;
  displayName: string;
  connectedAt: number;
  isHost: boolean;
}

interface DisconnectedEntry {
  userId: string;
  displayName: string;
  disconnectedAt: number;
  connectedAt: number; // original connect time for longest-connected calc
  isHost: boolean;
}

// Module-level state (singleton per process, cleaned up per session)
const activeConnections = new Map<string, Map<string, TrackedConnection>>();
const disconnectedEntries = new Map<string, Map<string, DisconnectedEntry>>();

export type { TrackedConnection, DisconnectedEntry };

export function trackConnection(
  sessionId: string,
  connection: TrackedConnection,
): { isReconnection: boolean } {
  if (!activeConnections.has(sessionId)) {
    activeConnections.set(sessionId, new Map());
  }

  // Check if this user was recently disconnected (reconnection)
  const disconnected = disconnectedEntries.get(sessionId)?.get(connection.userId);
  const isReconnection = !!disconnected;

  if (isReconnection) {
    // Preserve original connectedAt for longest-connected calculation
    connection.connectedAt = disconnected!.connectedAt;
    connection.isHost = disconnected!.isHost;
    disconnectedEntries.get(sessionId)!.delete(connection.userId);
  }

  activeConnections.get(sessionId)!.set(connection.userId, connection);
  return { isReconnection };
}

export function trackDisconnection(
  sessionId: string,
  userId: string,
): DisconnectedEntry | null {
  const sessions = activeConnections.get(sessionId);
  if (!sessions) return null;

  const connection = sessions.get(userId);
  if (!connection) return null;

  sessions.delete(userId);

  const entry: DisconnectedEntry = {
    userId: connection.userId,
    displayName: connection.displayName,
    disconnectedAt: Date.now(),
    connectedAt: connection.connectedAt,
    isHost: connection.isHost,
  };

  if (!disconnectedEntries.has(sessionId)) {
    disconnectedEntries.set(sessionId, new Map());
  }
  disconnectedEntries.get(sessionId)!.set(userId, entry);

  return entry;
}

export function getActiveConnections(sessionId: string): TrackedConnection[] {
  const sessions = activeConnections.get(sessionId);
  if (!sessions) return [];
  return Array.from(sessions.values());
}

export function getActiveCount(sessionId: string): number {
  return activeConnections.get(sessionId)?.size ?? 0;
}

export function isUserConnected(sessionId: string, userId: string): boolean {
  return activeConnections.get(sessionId)?.has(userId) ?? false;
}

export function getLongestConnected(
  sessionId: string,
  excludeUserId?: string,
): TrackedConnection | null {
  const sessions = activeConnections.get(sessionId);
  if (!sessions) return null;

  let oldest: TrackedConnection | null = null;
  for (const conn of sessions.values()) {
    if (excludeUserId && conn.userId === excludeUserId) continue;
    if (!oldest || conn.connectedAt < oldest.connectedAt) {
      oldest = conn;
    }
  }
  return oldest;
}

export function removeDisconnectedEntry(sessionId: string, userId: string): void {
  disconnectedEntries.get(sessionId)?.delete(userId);
}

export function removeSession(sessionId: string): void {
  activeConnections.delete(sessionId);
  disconnectedEntries.delete(sessionId);
}

export function updateHostStatus(
  sessionId: string,
  oldHostId: string,
  newHostId: string,
): void {
  const sessions = activeConnections.get(sessionId);
  if (!sessions) return;
  const oldHost = sessions.get(oldHostId);
  if (oldHost) oldHost.isHost = false;
  const newHost = sessions.get(newHostId);
  if (newHost) newHost.isHost = true;
}
