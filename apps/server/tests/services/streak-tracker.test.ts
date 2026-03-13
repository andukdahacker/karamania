import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordReactionStreak,
  clearSessionStreaks,
  clearUserStreak,
  clearStreakStore,
} from '../../src/services/streak-tracker.js';

describe('streak-tracker', () => {
  beforeEach(() => {
    clearStreakStore();
  });

  describe('recordReactionStreak', () => {
    it('returns streakCount 1 and no milestone on first reaction', () => {
      const result = recordReactionStreak('session-1', 'user-1', 1000);
      expect(result).toEqual({ streakCount: 1, milestone: null });
    });

    it('increments streak count on consecutive calls', () => {
      recordReactionStreak('session-1', 'user-1', 1000);
      const result = recordReactionStreak('session-1', 'user-1', 1500);
      expect(result).toEqual({ streakCount: 2, milestone: null });
    });

    it('returns milestone at exactly 5', () => {
      for (let i = 0; i < 4; i++) {
        recordReactionStreak('session-1', 'user-1', 1000 + i * 100);
      }
      const result = recordReactionStreak('session-1', 'user-1', 1400);
      expect(result).toEqual({ streakCount: 5, milestone: 5 });
    });

    it('returns milestone at exactly 10', () => {
      for (let i = 0; i < 9; i++) {
        recordReactionStreak('session-1', 'user-1', 1000 + i * 100);
      }
      const result = recordReactionStreak('session-1', 'user-1', 1900);
      expect(result).toEqual({ streakCount: 10, milestone: 10 });
    });

    it('returns milestone at exactly 20', () => {
      for (let i = 0; i < 19; i++) {
        recordReactionStreak('session-1', 'user-1', 1000 + i * 100);
      }
      const result = recordReactionStreak('session-1', 'user-1', 2900);
      expect(result).toEqual({ streakCount: 20, milestone: 20 });
    });

    it('returns milestone at exactly 50', () => {
      for (let i = 0; i < 49; i++) {
        recordReactionStreak('session-1', 'user-1', 1000 + i * 100);
      }
      const result = recordReactionStreak('session-1', 'user-1', 5900);
      expect(result).toEqual({ streakCount: 50, milestone: 50 });
    });

    it('returns null milestone for non-milestone counts', () => {
      for (let i = 0; i < 5; i++) {
        recordReactionStreak('session-1', 'user-1', 1000 + i * 100);
      }
      // Count is now 5 (milestone), next is 6 (not milestone)
      const result = recordReactionStreak('session-1', 'user-1', 1500);
      expect(result).toEqual({ streakCount: 6, milestone: null });
    });

    it('resets streak after 5s inactivity gap', () => {
      recordReactionStreak('session-1', 'user-1', 1000);
      recordReactionStreak('session-1', 'user-1', 2000);
      recordReactionStreak('session-1', 'user-1', 3000);
      // 5001ms gap — over the 5s threshold
      const result = recordReactionStreak('session-1', 'user-1', 8001);
      expect(result).toEqual({ streakCount: 1, milestone: null });
    });

    it('does NOT reset streak at exactly 5s gap (boundary test)', () => {
      recordReactionStreak('session-1', 'user-1', 1000);
      recordReactionStreak('session-1', 'user-1', 2000);
      // Exactly 5000ms gap — NOT over threshold (uses > not >=)
      const result = recordReactionStreak('session-1', 'user-1', 7000);
      expect(result).toEqual({ streakCount: 3, milestone: null });
    });

    it('does NOT reset at 4.9s gap', () => {
      recordReactionStreak('session-1', 'user-1', 1000);
      // 4900ms gap — under 5s threshold
      const result = recordReactionStreak('session-1', 'user-1', 5900);
      expect(result).toEqual({ streakCount: 2, milestone: null });
    });

    it('tracks users independently within same session', () => {
      recordReactionStreak('session-1', 'user-1', 1000);
      recordReactionStreak('session-1', 'user-1', 1100);
      const r1 = recordReactionStreak('session-1', 'user-1', 1200);
      expect(r1.streakCount).toBe(3);

      const r2 = recordReactionStreak('session-1', 'user-2', 1200);
      expect(r2.streakCount).toBe(1);
    });

    it('tracks sessions independently for same user', () => {
      recordReactionStreak('session-1', 'user-1', 1000);
      recordReactionStreak('session-1', 'user-1', 1100);
      const r1 = recordReactionStreak('session-1', 'user-1', 1200);
      expect(r1.streakCount).toBe(3);

      const r2 = recordReactionStreak('session-2', 'user-1', 1200);
      expect(r2.streakCount).toBe(1);
    });
  });

  describe('clearSessionStreaks', () => {
    it('removes all streaks for a session', () => {
      recordReactionStreak('session-1', 'user-1', 1000);
      recordReactionStreak('session-1', 'user-2', 1000);
      clearSessionStreaks('session-1');

      // Both users start fresh
      const r1 = recordReactionStreak('session-1', 'user-1', 2000);
      const r2 = recordReactionStreak('session-1', 'user-2', 2000);
      expect(r1.streakCount).toBe(1);
      expect(r2.streakCount).toBe(1);
    });

    it('does NOT affect other sessions', () => {
      recordReactionStreak('session-1', 'user-1', 1000);
      recordReactionStreak('session-1', 'user-1', 1100);
      recordReactionStreak('session-2', 'user-1', 1000);
      recordReactionStreak('session-2', 'user-1', 1100);

      clearSessionStreaks('session-1');

      // session-1 user resets
      const r1 = recordReactionStreak('session-1', 'user-1', 2000);
      expect(r1.streakCount).toBe(1);

      // session-2 user continues
      const r2 = recordReactionStreak('session-2', 'user-1', 2000);
      expect(r2.streakCount).toBe(3);
    });
  });

  describe('clearUserStreak', () => {
    it('removes single user streak', () => {
      recordReactionStreak('session-1', 'user-1', 1000);
      recordReactionStreak('session-1', 'user-1', 1100);
      clearUserStreak('session-1', 'user-1');

      const result = recordReactionStreak('session-1', 'user-1', 2000);
      expect(result.streakCount).toBe(1);
    });

    it('does not affect other users in same session', () => {
      recordReactionStreak('session-1', 'user-1', 1000);
      recordReactionStreak('session-1', 'user-1', 1100);
      recordReactionStreak('session-1', 'user-2', 1000);
      recordReactionStreak('session-1', 'user-2', 1100);

      clearUserStreak('session-1', 'user-1');

      const r2 = recordReactionStreak('session-1', 'user-2', 2000);
      expect(r2.streakCount).toBe(3);
    });
  });

  describe('clearStreakStore', () => {
    it('removes all data', () => {
      recordReactionStreak('session-1', 'user-1', 1000);
      recordReactionStreak('session-2', 'user-2', 1000);
      clearStreakStore();

      const r1 = recordReactionStreak('session-1', 'user-1', 2000);
      const r2 = recordReactionStreak('session-2', 'user-2', 2000);
      expect(r1.streakCount).toBe(1);
      expect(r2.streakCount).toBe(1);
    });
  });
});
