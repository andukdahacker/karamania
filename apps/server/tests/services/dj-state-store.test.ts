import { describe, it, expect, beforeEach } from 'vitest';
import { createTestDJContext } from '../factories/dj-state.js';
import {
  getSessionDjState,
  setSessionDjState,
  removeSessionDjState,
  getAllActiveSessions,
  clearAllSessions,
} from '../../src/services/dj-state-store.js';

describe('dj-state-store', () => {
  beforeEach(() => {
    clearAllSessions();
  });

  describe('setSessionDjState / getSessionDjState', () => {
    it('stores and retrieves DJ state by session ID', () => {
      const context = createTestDJContext({ sessionId: 'session-1' });
      setSessionDjState('session-1', context);

      expect(getSessionDjState('session-1')).toEqual(context);
    });

    it('returns undefined for unknown session', () => {
      expect(getSessionDjState('nonexistent')).toBeUndefined();
    });

    it('overwrites existing state for same session', () => {
      const context1 = createTestDJContext({ sessionId: 'session-1', songCount: 0 });
      const context2 = createTestDJContext({ sessionId: 'session-1', songCount: 5 });

      setSessionDjState('session-1', context1);
      setSessionDjState('session-1', context2);

      expect(getSessionDjState('session-1')?.songCount).toBe(5);
    });
  });

  describe('removeSessionDjState', () => {
    it('removes state for a session', () => {
      const context = createTestDJContext({ sessionId: 'session-1' });
      setSessionDjState('session-1', context);
      removeSessionDjState('session-1');

      expect(getSessionDjState('session-1')).toBeUndefined();
    });

    it('does not throw when removing nonexistent session', () => {
      expect(() => removeSessionDjState('nonexistent')).not.toThrow();
    });
  });

  describe('getAllActiveSessions', () => {
    it('returns all stored session IDs', () => {
      setSessionDjState('session-1', createTestDJContext({ sessionId: 'session-1' }));
      setSessionDjState('session-2', createTestDJContext({ sessionId: 'session-2' }));

      const sessions = getAllActiveSessions();
      expect(sessions).toHaveLength(2);
      expect(sessions.map(s => s.sessionId)).toEqual(expect.arrayContaining(['session-1', 'session-2']));
    });

    it('returns empty array when no sessions stored', () => {
      expect(getAllActiveSessions()).toEqual([]);
    });
  });

  describe('clearAllSessions', () => {
    it('removes all stored sessions', () => {
      setSessionDjState('session-1', createTestDJContext({ sessionId: 'session-1' }));
      setSessionDjState('session-2', createTestDJContext({ sessionId: 'session-2' }));
      clearAllSessions();

      expect(getAllActiveSessions()).toEqual([]);
    });
  });
});
