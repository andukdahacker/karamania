import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  recordActivity,
  getLastActivity,
  removeSession,
  clearAll,
} from '../../src/services/activity-tracker.js';

describe('activity-tracker', () => {
  beforeEach(() => {
    clearAll();
  });

  describe('recordActivity', () => {
    it('stores timestamp for session', () => {
      const before = Date.now();
      recordActivity('session-1');
      const after = Date.now();

      const lastActivity = getLastActivity('session-1');
      expect(lastActivity).toBeGreaterThanOrEqual(before);
      expect(lastActivity).toBeLessThanOrEqual(after);
    });

    it('updates timestamp on subsequent calls', () => {
      recordActivity('session-1');
      const first = getLastActivity('session-1');

      // Small delay to ensure different timestamp
      vi.useFakeTimers();
      vi.setSystemTime(Date.now() + 1000);
      recordActivity('session-1');
      const second = getLastActivity('session-1');

      expect(second).toBeGreaterThan(first!);
      vi.useRealTimers();
    });
  });

  describe('getLastActivity', () => {
    it('returns undefined for unknown session', () => {
      expect(getLastActivity('nonexistent')).toBeUndefined();
    });

    it('returns correct timestamp', () => {
      vi.useFakeTimers();
      vi.setSystemTime(1234567890);
      recordActivity('session-1');
      expect(getLastActivity('session-1')).toBe(1234567890);
      vi.useRealTimers();
    });
  });

  describe('removeSession', () => {
    it('cleans up session data', () => {
      recordActivity('session-1');
      expect(getLastActivity('session-1')).toBeDefined();

      removeSession('session-1');
      expect(getLastActivity('session-1')).toBeUndefined();
    });

    it('does not throw for unknown session', () => {
      expect(() => removeSession('nonexistent')).not.toThrow();
    });
  });

  describe('clearAll', () => {
    it('removes all sessions', () => {
      recordActivity('session-1');
      recordActivity('session-2');

      clearAll();

      expect(getLastActivity('session-1')).toBeUndefined();
      expect(getLastActivity('session-2')).toBeUndefined();
    });
  });
});
