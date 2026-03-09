import { describe, it, expect, afterEach } from 'vitest';
import {
  trackConnection,
  trackDisconnection,
  getActiveConnections,
  getActiveCount,
  isUserConnected,
  getLongestConnected,
  removeDisconnectedEntry,
  removeSession,
  updateHostStatus,
} from '../../src/services/connection-tracker.js';
import type { TrackedConnection } from '../../src/services/connection-tracker.js';

function makeConnection(overrides?: Partial<TrackedConnection>): TrackedConnection {
  return {
    socketId: overrides?.socketId ?? 'socket-1',
    userId: overrides?.userId ?? 'user-1',
    displayName: overrides?.displayName ?? 'Alice',
    connectedAt: overrides?.connectedAt ?? Date.now(),
    isHost: overrides?.isHost ?? false,
  };
}

describe('connection-tracker', () => {
  const SESSION_A = 'session-a';
  const SESSION_B = 'session-b';

  afterEach(() => {
    removeSession(SESSION_A);
    removeSession(SESSION_B);
  });

  describe('trackConnection', () => {
    it('adds connection to active map', () => {
      const conn = makeConnection({ userId: 'user-1' });
      trackConnection(SESSION_A, conn);

      expect(getActiveConnections(SESSION_A)).toEqual([conn]);
    });

    it('detects reconnection when user was disconnected', () => {
      const conn = makeConnection({ userId: 'user-1', connectedAt: 1000 });
      trackConnection(SESSION_A, conn);
      trackDisconnection(SESSION_A, 'user-1');

      const reconnectConn = makeConnection({
        userId: 'user-1',
        socketId: 'socket-new',
        connectedAt: 9999,
      });
      const result = trackConnection(SESSION_A, reconnectConn);

      expect(result.isReconnection).toBe(true);
    });

    it('returns isReconnection false for new connection', () => {
      const conn = makeConnection({ userId: 'user-1' });
      const result = trackConnection(SESSION_A, conn);

      expect(result.isReconnection).toBe(false);
    });

    it('preserves original connectedAt on reconnection', () => {
      const originalTime = 1000;
      const conn = makeConnection({ userId: 'user-1', connectedAt: originalTime });
      trackConnection(SESSION_A, conn);
      trackDisconnection(SESSION_A, 'user-1');

      const reconnectConn = makeConnection({
        userId: 'user-1',
        socketId: 'socket-new',
        connectedAt: 9999,
      });
      trackConnection(SESSION_A, reconnectConn);

      const active = getActiveConnections(SESSION_A);
      expect(active[0].connectedAt).toBe(originalTime);
    });

    it('preserves isHost on reconnection', () => {
      const conn = makeConnection({ userId: 'user-1', isHost: true, connectedAt: 1000 });
      trackConnection(SESSION_A, conn);
      trackDisconnection(SESSION_A, 'user-1');

      const reconnectConn = makeConnection({
        userId: 'user-1',
        socketId: 'socket-new',
        isHost: false,
        connectedAt: 9999,
      });
      trackConnection(SESSION_A, reconnectConn);

      const active = getActiveConnections(SESSION_A);
      expect(active[0].isHost).toBe(true);
    });
  });

  describe('trackDisconnection', () => {
    it('moves connection from active to disconnected map', () => {
      const conn = makeConnection({ userId: 'user-1' });
      trackConnection(SESSION_A, conn);
      const entry = trackDisconnection(SESSION_A, 'user-1');

      expect(entry).not.toBeNull();
      expect(entry!.userId).toBe('user-1');
      expect(entry!.displayName).toBe('Alice');
      expect(entry!.disconnectedAt).toBeGreaterThan(0);
      expect(isUserConnected(SESSION_A, 'user-1')).toBe(false);
    });

    it('returns null for unknown user', () => {
      const result = trackDisconnection(SESSION_A, 'unknown-user');

      expect(result).toBeNull();
    });

    it('returns null for unknown session', () => {
      const result = trackDisconnection('nonexistent-session', 'user-1');

      expect(result).toBeNull();
    });
  });

  describe('getActiveConnections', () => {
    it('returns all active connections for session', () => {
      const conn1 = makeConnection({ userId: 'user-1', socketId: 'socket-1' });
      const conn2 = makeConnection({ userId: 'user-2', socketId: 'socket-2', displayName: 'Bob' });
      trackConnection(SESSION_A, conn1);
      trackConnection(SESSION_A, conn2);

      const active = getActiveConnections(SESSION_A);

      expect(active).toHaveLength(2);
      expect(active.map(c => c.userId).sort()).toEqual(['user-1', 'user-2']);
    });

    it('returns empty array for unknown session', () => {
      expect(getActiveConnections('nonexistent')).toEqual([]);
    });
  });

  describe('getActiveCount', () => {
    it('returns correct count', () => {
      trackConnection(SESSION_A, makeConnection({ userId: 'user-1', socketId: 'socket-1' }));
      trackConnection(SESSION_A, makeConnection({ userId: 'user-2', socketId: 'socket-2' }));
      trackConnection(SESSION_A, makeConnection({ userId: 'user-3', socketId: 'socket-3' }));

      expect(getActiveCount(SESSION_A)).toBe(3);
    });

    it('returns 0 for unknown session', () => {
      expect(getActiveCount('nonexistent')).toBe(0);
    });
  });

  describe('isUserConnected', () => {
    it('returns true for active users', () => {
      trackConnection(SESSION_A, makeConnection({ userId: 'user-1' }));

      expect(isUserConnected(SESSION_A, 'user-1')).toBe(true);
    });

    it('returns false for disconnected users', () => {
      trackConnection(SESSION_A, makeConnection({ userId: 'user-1' }));
      trackDisconnection(SESSION_A, 'user-1');

      expect(isUserConnected(SESSION_A, 'user-1')).toBe(false);
    });

    it('returns false for unknown user', () => {
      expect(isUserConnected(SESSION_A, 'unknown')).toBe(false);
    });
  });

  describe('getLongestConnected', () => {
    it('returns oldest connection', () => {
      trackConnection(SESSION_A, makeConnection({ userId: 'user-old', socketId: 's1', connectedAt: 1000 }));
      trackConnection(SESSION_A, makeConnection({ userId: 'user-mid', socketId: 's2', connectedAt: 2000 }));
      trackConnection(SESSION_A, makeConnection({ userId: 'user-new', socketId: 's3', connectedAt: 3000 }));

      const oldest = getLongestConnected(SESSION_A);

      expect(oldest).not.toBeNull();
      expect(oldest!.userId).toBe('user-old');
      expect(oldest!.connectedAt).toBe(1000);
    });

    it('excludes specified userId', () => {
      trackConnection(SESSION_A, makeConnection({ userId: 'user-old', socketId: 's1', connectedAt: 1000 }));
      trackConnection(SESSION_A, makeConnection({ userId: 'user-mid', socketId: 's2', connectedAt: 2000 }));
      trackConnection(SESSION_A, makeConnection({ userId: 'user-new', socketId: 's3', connectedAt: 3000 }));

      const oldest = getLongestConnected(SESSION_A, 'user-old');

      expect(oldest).not.toBeNull();
      expect(oldest!.userId).toBe('user-mid');
    });

    it('returns null for empty session', () => {
      expect(getLongestConnected(SESSION_A)).toBeNull();
    });

    it('returns null when all users excluded', () => {
      trackConnection(SESSION_A, makeConnection({ userId: 'user-only', socketId: 's1' }));

      expect(getLongestConnected(SESSION_A, 'user-only')).toBeNull();
    });
  });

  describe('removeDisconnectedEntry', () => {
    it('cleans up specific entry', () => {
      trackConnection(SESSION_A, makeConnection({ userId: 'user-1', connectedAt: 1000 }));
      trackDisconnection(SESSION_A, 'user-1');

      removeDisconnectedEntry(SESSION_A, 'user-1');

      // Reconnection should NOT detect the removed entry
      const reconnectConn = makeConnection({ userId: 'user-1', socketId: 'socket-new', connectedAt: 9999 });
      const result = trackConnection(SESSION_A, reconnectConn);
      expect(result.isReconnection).toBe(false);
    });

    it('does not throw for unknown entry', () => {
      expect(() => removeDisconnectedEntry(SESSION_A, 'unknown')).not.toThrow();
    });
  });

  describe('removeSession', () => {
    it('cleans up all data for session', () => {
      trackConnection(SESSION_A, makeConnection({ userId: 'user-1', socketId: 's1' }));
      trackConnection(SESSION_A, makeConnection({ userId: 'user-2', socketId: 's2' }));
      trackDisconnection(SESSION_A, 'user-2');

      removeSession(SESSION_A);

      expect(getActiveConnections(SESSION_A)).toEqual([]);
      expect(getActiveCount(SESSION_A)).toBe(0);
      expect(isUserConnected(SESSION_A, 'user-1')).toBe(false);

      // Disconnected entries also cleared — reconnection not detected
      const reconnectConn = makeConnection({ userId: 'user-2', socketId: 'socket-new', connectedAt: 9999 });
      const result = trackConnection(SESSION_A, reconnectConn);
      expect(result.isReconnection).toBe(false);

      // Clean up new connection we just made
      removeSession(SESSION_A);
    });
  });

  describe('updateHostStatus', () => {
    it('swaps host flag between users', () => {
      trackConnection(SESSION_A, makeConnection({ userId: 'host-user', socketId: 's1', isHost: true }));
      trackConnection(SESSION_A, makeConnection({ userId: 'new-host', socketId: 's2', isHost: false }));

      updateHostStatus(SESSION_A, 'host-user', 'new-host');

      const connections = getActiveConnections(SESSION_A);
      const oldHost = connections.find(c => c.userId === 'host-user');
      const newHost = connections.find(c => c.userId === 'new-host');

      expect(oldHost!.isHost).toBe(false);
      expect(newHost!.isHost).toBe(true);
    });

    it('does not throw for unknown session', () => {
      expect(() => updateHostStatus('nonexistent', 'a', 'b')).not.toThrow();
    });
  });

  describe('multiple sessions', () => {
    it('tracks sessions independently', () => {
      trackConnection(SESSION_A, makeConnection({ userId: 'user-a', socketId: 'sa' }));
      trackConnection(SESSION_B, makeConnection({ userId: 'user-b', socketId: 'sb' }));

      expect(getActiveCount(SESSION_A)).toBe(1);
      expect(getActiveCount(SESSION_B)).toBe(1);
      expect(isUserConnected(SESSION_A, 'user-a')).toBe(true);
      expect(isUserConnected(SESSION_A, 'user-b')).toBe(false);
      expect(isUserConnected(SESSION_B, 'user-b')).toBe(true);
      expect(isUserConnected(SESSION_B, 'user-a')).toBe(false);

      removeSession(SESSION_A);

      expect(getActiveCount(SESSION_A)).toBe(0);
      expect(getActiveCount(SESSION_B)).toBe(1);
    });
  });
});
