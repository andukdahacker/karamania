import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  scheduleSessionTimer,
  cancelSessionTimer,
  getActiveTimer,
  clearAllTimers,
} from '../../src/services/timer-scheduler.js';

describe('timer-scheduler', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearAllTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('scheduleSessionTimer', () => {
    it('calls onTimeout after specified duration', () => {
      const onTimeout = vi.fn();
      scheduleSessionTimer('session-1', 5000, onTimeout);

      vi.advanceTimersByTime(5000);

      expect(onTimeout).toHaveBeenCalledOnce();
    });

    it('does not call onTimeout before duration elapses', () => {
      const onTimeout = vi.fn();
      scheduleSessionTimer('session-1', 5000, onTimeout);

      vi.advanceTimersByTime(4999);

      expect(onTimeout).not.toHaveBeenCalled();
    });

    it('clears existing timer when scheduling new one for same session', () => {
      const onTimeout1 = vi.fn();
      const onTimeout2 = vi.fn();

      scheduleSessionTimer('session-1', 5000, onTimeout1);
      scheduleSessionTimer('session-1', 3000, onTimeout2);

      vi.advanceTimersByTime(5000);

      expect(onTimeout1).not.toHaveBeenCalled();
      expect(onTimeout2).toHaveBeenCalledOnce();
    });

    it('manages timers independently for different sessions', () => {
      const onTimeout1 = vi.fn();
      const onTimeout2 = vi.fn();

      scheduleSessionTimer('session-1', 3000, onTimeout1);
      scheduleSessionTimer('session-2', 5000, onTimeout2);

      vi.advanceTimersByTime(3000);
      expect(onTimeout1).toHaveBeenCalledOnce();
      expect(onTimeout2).not.toHaveBeenCalled();

      vi.advanceTimersByTime(2000);
      expect(onTimeout2).toHaveBeenCalledOnce();
    });
  });

  describe('cancelSessionTimer', () => {
    it('prevents scheduled timer from firing', () => {
      const onTimeout = vi.fn();
      scheduleSessionTimer('session-1', 5000, onTimeout);

      cancelSessionTimer('session-1');
      vi.advanceTimersByTime(10000);

      expect(onTimeout).not.toHaveBeenCalled();
    });

    it('does not throw when cancelling nonexistent timer', () => {
      expect(() => cancelSessionTimer('nonexistent')).not.toThrow();
    });
  });

  describe('getActiveTimer', () => {
    it('returns true when timer is active', () => {
      scheduleSessionTimer('session-1', 5000, vi.fn());
      expect(getActiveTimer('session-1')).toBe(true);
    });

    it('returns false after timer fires', () => {
      scheduleSessionTimer('session-1', 5000, vi.fn());
      vi.advanceTimersByTime(5000);
      expect(getActiveTimer('session-1')).toBe(false);
    });

    it('returns false after timer is cancelled', () => {
      scheduleSessionTimer('session-1', 5000, vi.fn());
      cancelSessionTimer('session-1');
      expect(getActiveTimer('session-1')).toBe(false);
    });

    it('returns false for unknown session', () => {
      expect(getActiveTimer('nonexistent')).toBe(false);
    });
  });

  describe('clearAllTimers', () => {
    it('cancels all active timers', () => {
      const onTimeout1 = vi.fn();
      const onTimeout2 = vi.fn();

      scheduleSessionTimer('session-1', 5000, onTimeout1);
      scheduleSessionTimer('session-2', 5000, onTimeout2);

      clearAllTimers();
      vi.advanceTimersByTime(10000);

      expect(onTimeout1).not.toHaveBeenCalled();
      expect(onTimeout2).not.toHaveBeenCalled();
    });
  });
});
