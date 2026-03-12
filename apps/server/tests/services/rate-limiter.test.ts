import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  checkRateLimit,
  recordUserEvent,
  cleanupStaleTimestamps,
  clearRateLimitStore,
} from '../../src/services/rate-limiter.js';

describe('rate-limiter', () => {
  describe('checkRateLimit', () => {
    it('returns multiplier 1.0 when under limit', () => {
      const events = [1000, 2000, 3000];
      const result = checkRateLimit(events, 4000, 5000, 10);
      expect(result.allowed).toBe(true);
      expect(result.rewardMultiplier).toBe(1.0);
    });

    it('returns full multiplier at exactly maxEvents (overage=0)', () => {
      const now = 10000;
      // 10 events within window = exactly at limit, overage=0 → pow(0.5,0)=1
      const events = Array.from({ length: 10 }, (_, i) => now - 4000 + i * 100);
      const result = checkRateLimit(events, now, 5000, 10);
      expect(result.allowed).toBe(true);
      expect(result.rewardMultiplier).toBe(1.0);
    });

    it('returns degraded multiplier at 1 over maxEvents (0.5)', () => {
      const now = 10000;
      // 11 events within window → overage=1 → pow(0.5,1)=0.5
      const events = Array.from({ length: 11 }, (_, i) => now - 4000 + i * 100);
      const result = checkRateLimit(events, now, 5000, 10);
      expect(result.allowed).toBe(true);
      expect(result.rewardMultiplier).toBe(0.5);
    });

    it('returns multiplier 0 at 2x maxEvents', () => {
      const now = 10000;
      const events = Array.from({ length: 20 }, (_, i) => now - 4000 + i * 100);
      const result = checkRateLimit(events, now, 5000, 10);
      expect(result.allowed).toBe(true);
      expect(result.rewardMultiplier).toBe(0);
    });

    it('excludes events outside window', () => {
      const now = 10000;
      // 15 events but only 5 are within the 5s window
      const oldEvents = Array.from({ length: 10 }, (_, i) => now - 10000 + i * 100);
      const recentEvents = Array.from({ length: 5 }, (_, i) => now - 2000 + i * 100);
      const events = [...oldEvents, ...recentEvents];
      const result = checkRateLimit(events, now, 5000, 10);
      expect(result.allowed).toBe(true);
      expect(result.rewardMultiplier).toBe(1.0);
    });

    it('inactivity reset returns full multiplier when last event is old', () => {
      const now = 20000;
      // 15 events, but last one was 6s ago (> inactivityResetMs of 5s)
      const events = Array.from({ length: 15 }, (_, i) => now - 6000 - i * 100);
      const result = checkRateLimit(events, now, 5000, 10, 5000);
      expect(result.allowed).toBe(true);
      expect(result.rewardMultiplier).toBe(1.0);
    });

    it('inactivity reset does NOT apply when last event is within threshold', () => {
      const now = 10000;
      // Create events where last event is within inactivityResetMs
      const events = Array.from({ length: 12 }, (_, i) => now - 4000 + i * 300);
      const result = checkRateLimit(events, now, 5000, 10, 5000);
      expect(result.allowed).toBe(true);
      // Should be degraded, not full multiplier
      expect(result.rewardMultiplier).toBeLessThan(1.0);
    });

    it('returns full multiplier with empty events array', () => {
      const result = checkRateLimit([], 10000, 5000, 10);
      expect(result.allowed).toBe(true);
      expect(result.rewardMultiplier).toBe(1.0);
    });

    it('never hard-blocks (always allowed: true)', () => {
      const now = 10000;
      const events = Array.from({ length: 100 }, (_, i) => now - 1000 + i * 10);
      const result = checkRateLimit(events, now, 5000, 10);
      expect(result.allowed).toBe(true);
    });
  });

  describe('recordUserEvent', () => {
    beforeEach(() => {
      clearRateLimitStore();
    });

    it('appends timestamp and returns array', () => {
      const result = recordUserEvent('user-1', 1000);
      expect(result).toEqual([1000]);
    });

    it('accumulates timestamps for same user', () => {
      recordUserEvent('user-1', 1000);
      const result = recordUserEvent('user-1', 2000);
      expect(result).toEqual([1000, 2000]);
    });

    it('tracks users independently', () => {
      recordUserEvent('user-1', 1000);
      recordUserEvent('user-2', 2000);
      const result1 = recordUserEvent('user-1', 3000);
      expect(result1).toEqual([1000, 3000]);
    });

    it('prunes timestamps older than 2x windowMs', () => {
      const now = 100000;
      // Add timestamps that will be outside 2x window (2 * 5000 = 10000ms cutoff)
      recordUserEvent('user-1', now - 20000, 5000); // 20s ago, outside 2x5s
      recordUserEvent('user-1', now - 15000, 5000); // 15s ago, outside 2x5s
      recordUserEvent('user-1', now - 5000, 5000);  // 5s ago, within 2x5s
      const result = recordUserEvent('user-1', now, 5000); // now
      // Old timestamps should be pruned, only recent ones remain
      expect(result).toEqual([now - 5000, now]);
    });
  });

  describe('cleanupStaleTimestamps', () => {
    beforeEach(() => {
      clearRateLimitStore();
    });

    it('removes entries older than window', () => {
      const now = Date.now();
      vi.spyOn(Date, 'now').mockReturnValue(now);

      // Record old event (40s ago — outside 30s window)
      recordUserEvent('user-old', now - 40000);
      // Record fresh event
      recordUserEvent('user-fresh', now - 1000);

      cleanupStaleTimestamps(30000);

      // Old user should be removed, fresh user retained
      const freshResult = recordUserEvent('user-fresh', now);
      expect(freshResult).toEqual([now - 1000, now]); // old event + new
      const oldResult = recordUserEvent('user-old', now);
      expect(oldResult).toEqual([now]); // only new event — old was cleaned up

      vi.restoreAllMocks();
    });
  });

  describe('clearRateLimitStore', () => {
    it('empties everything', () => {
      recordUserEvent('user-1', 1000);
      recordUserEvent('user-2', 2000);
      clearRateLimitStore();

      // After clear, new calls should start fresh
      const result = recordUserEvent('user-1', 3000);
      expect(result).toEqual([3000]);
    });
  });
});
