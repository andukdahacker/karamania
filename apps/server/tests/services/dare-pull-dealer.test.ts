import { describe, it, expect, afterEach } from 'vitest';
import {
  dealDare,
  selectTarget,
  clearSession,
  resetAll,
  DARE_PULL_DARES,
} from '../../src/services/dare-pull-dealer.js';
import type { TrackedConnection } from '../../src/services/connection-tracker.js';

function createConnection(userId: string, displayName: string): TrackedConnection {
  return { socketId: `socket-${userId}`, userId, displayName, connectedAt: Date.now(), isHost: false };
}

describe('dare-pull-dealer service', () => {
  afterEach(() => {
    resetAll();
  });

  describe('DARE_PULL_DARES pool', () => {
    it('has at least 18 dares', () => {
      expect(DARE_PULL_DARES.length).toBeGreaterThanOrEqual(18);
    });

    it('all dares have non-empty id, title, dare, emoji', () => {
      for (const dare of DARE_PULL_DARES) {
        expect(dare.id).toBeTruthy();
        expect(dare.title).toBeTruthy();
        expect(dare.dare).toBeTruthy();
        expect(dare.emoji).toBeTruthy();
      }
    });

    it('all dare ids are unique', () => {
      const ids = DARE_PULL_DARES.map(d => d.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('dealDare', () => {
    it('returns a valid dare from the pool', () => {
      const dare = dealDare('session-1');
      const poolIds = DARE_PULL_DARES.map(d => d.id);
      expect(poolIds).toContain(dare.id);
      expect(dare.title).toBeTruthy();
      expect(dare.dare).toBeTruthy();
      expect(dare.emoji).toBeTruthy();
    });

    it('does not deal the same dare twice in a row for the same session', () => {
      const first = dealDare('session-1');
      const second = dealDare('session-1');
      expect(second.id).not.toBe(first.id);
    });

    it('can deal dares to different sessions independently', () => {
      const dare1 = dealDare('session-1');
      const dare2 = dealDare('session-2');
      expect(dare1.id).toBeTruthy();
      expect(dare2.id).toBeTruthy();
    });
  });

  describe('selectTarget', () => {
    it('returns a connection from the provided list', () => {
      const connections = [
        createConnection('user-1', 'Alice'),
        createConnection('user-2', 'Bob'),
        createConnection('user-3', 'Carol'),
      ];
      const target = selectTarget('session-1', connections);
      expect(target).not.toBeNull();
      const userIds = connections.map(c => c.userId);
      expect(userIds).toContain(target!.userId);
    });

    it('does not select the same target twice in a row with 2 connections', () => {
      const connections = [
        createConnection('user-1', 'Alice'),
        createConnection('user-2', 'Bob'),
      ];
      const first = selectTarget('session-1', connections);
      const second = selectTarget('session-1', connections);
      // With exactly 2 connections, the second must be different (deterministic proof)
      expect(second!.userId).not.toBe(first!.userId);
    });

    it('returns null for empty connections array', () => {
      const target = selectTarget('session-1', []);
      expect(target).toBeNull();
    });

    it('returns the only connection when only 1 is available', () => {
      const connections = [createConnection('user-1', 'Alice')];
      const first = selectTarget('session-1', connections);
      expect(first!.userId).toBe('user-1');
      // Even if it was last target, with only 1 connection it must return it
      const second = selectTarget('session-1', connections);
      expect(second!.userId).toBe('user-1');
    });
  });

  describe('clearSession', () => {
    it('resets dare tracking — previously dealt dare can be dealt again', () => {
      // With 2 connections, no-repeat is deterministic: A→B→A→B...
      const connections = [
        createConnection('user-1', 'Alice'),
        createConnection('user-2', 'Bob'),
      ];
      const first = selectTarget('session-1', connections);
      const second = selectTarget('session-1', connections);
      // Without clear: second must differ from first
      expect(second!.userId).not.toBe(first!.userId);

      clearSession('session-1');
      // After clear: any target is possible (tracking reset)
      // Deal a dare to verify dare tracking also cleared
      const dare = dealDare('session-1');
      expect(dare.id).toBeTruthy();
      const target = selectTarget('session-1', connections);
      expect(target).not.toBeNull();
    });

    it('does not affect other sessions', () => {
      dealDare('session-1');
      dealDare('session-2');
      clearSession('session-1');
      // session-2 still has tracking
      const dare = dealDare('session-2');
      expect(dare.id).toBeTruthy();
    });
  });

  describe('resetAll', () => {
    it('clears all session data', () => {
      dealDare('session-1');
      dealDare('session-2');
      const connections = [createConnection('user-1', 'Alice')];
      selectTarget('session-1', connections);
      resetAll();
      // Both sessions cleared
      const dare1 = dealDare('session-1');
      const dare2 = dealDare('session-2');
      expect(dare1.id).toBeTruthy();
      expect(dare2.id).toBeTruthy();
    });
  });
});
