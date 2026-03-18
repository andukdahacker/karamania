import { describe, it, expect, beforeEach } from 'vitest';
import {
  recordReaction,
  resetLastPeak,
  clearSession,
  clearAllSessions,
  BASELINE_WINDOW_MS,
  MIN_REACTIONS_FOR_PEAK,
  PEAK_COOLDOWN_MS,
} from '../../src/services/peak-detector.js';

describe('peak-detector', () => {
  beforeEach(() => {
    clearAllSessions();
  });

  describe('no peak below MIN_REACTIONS_FOR_PEAK', () => {
    it('returns false with 5 reactions in 10s (below minimum of 8)', () => {
      const now = 1_000_000;
      for (let i = 0; i < 5; i++) {
        const result = recordReaction('s1', now + i * 1000);
        expect(result).toBe(false);
      }
    });
  });

  describe('no peak when rate is high but below SPIKE_MULTIPLIER of baseline', () => {
    it('returns false with steady 6/10s baseline and spike to 12/10s (only 2x)', () => {
      const baseStart = 1_000_000;
      // Build steady baseline: 6 reactions per 10s for 5 minutes
      // 6 per 10s = 0.6/s, over 300s = 180 reactions
      for (let i = 0; i < 180; i++) {
        const t = baseStart + i * (BASELINE_WINDOW_MS / 180);
        recordReaction('s1', t);
      }

      // Now spike to 12 in 10s (2x baseline — below 3x threshold)
      const spikeStart = baseStart + BASELINE_WINDOW_MS + 1;
      for (let i = 0; i < 12; i++) {
        const result = recordReaction('s1', spikeStart + i * 800);
        expect(result).toBe(false);
      }
    });
  });

  describe('peak detected when conditions met', () => {
    it('detects peak when currentCount >= MIN and >= baselineRate * SPIKE_MULTIPLIER', () => {
      const baseStart = 1_000_000;
      // Build moderate baseline: 3 reactions per 10s for 5 minutes = 90 reactions
      for (let i = 0; i < 90; i++) {
        const t = baseStart + i * (BASELINE_WINDOW_MS / 90);
        recordReaction('s1', t);
      }

      // Spike to 10 in 10s (3.3x baseline — above 3x threshold and above MIN of 8)
      const spikeStart = baseStart + BASELINE_WINDOW_MS + 1;
      let peakDetected = false;
      for (let i = 0; i < 10; i++) {
        const result = recordReaction('s1', spikeStart + i * 900);
        if (result) peakDetected = true;
      }
      expect(peakDetected).toBe(true);
    });
  });

  describe('peak suppression', () => {
    it('second spike within 60s returns false', () => {
      const now = 1_000_000;
      // Cold start: 10 reactions in 10s → peak
      let peakDetected = false;
      for (let i = 0; i < 10; i++) {
        if (recordReaction('s1', now + i * 1000)) peakDetected = true;
      }
      expect(peakDetected).toBe(true);

      // Second burst 30s later — within cooldown
      const secondBurst = now + 30_000;
      for (let i = 0; i < 10; i++) {
        const result = recordReaction('s1', secondBurst + i * 1000);
        expect(result).toBe(false);
      }
    });

    it('peak detection works again after 60s cooldown expires', () => {
      const now = 1_000_000;
      // First peak (cold start)
      for (let i = 0; i < 10; i++) {
        recordReaction('s1', now + i * 1000);
      }

      // After cooldown expires
      const afterCooldown = now + PEAK_COOLDOWN_MS + 1;
      let peakDetected = false;
      for (let i = 0; i < 10; i++) {
        if (recordReaction('s1', afterCooldown + i * 1000)) peakDetected = true;
      }
      expect(peakDetected).toBe(true);
    });
  });

  describe('cold start', () => {
    it('first 10s of a session with 8+ reactions triggers peak (no baseline)', () => {
      const now = 1_000_000;
      let peakDetected = false;
      for (let i = 0; i < MIN_REACTIONS_FOR_PEAK; i++) {
        if (recordReaction('s1', now + i * 1000)) peakDetected = true;
      }
      expect(peakDetected).toBe(true);
    });
  });

  describe('old timestamp pruning', () => {
    it('timestamps older than baseline window are pruned', () => {
      const start = 1_000_000;
      // Add some early reactions
      for (let i = 0; i < 5; i++) {
        recordReaction('s1', start + i * 1000);
      }

      // Add reaction well after baseline window
      const farFuture = start + BASELINE_WINDOW_MS + 10_000;
      recordReaction('s1', farFuture);

      // The early reactions should be pruned — a new cold start burst should trigger peak
      let peakDetected = false;
      for (let i = 1; i <= MIN_REACTIONS_FOR_PEAK; i++) {
        if (recordReaction('s1', farFuture + i * 500)) peakDetected = true;
      }
      expect(peakDetected).toBe(true);
    });
  });

  describe('clearSession', () => {
    it('removes all state; subsequent recordReaction starts fresh', () => {
      const now = 1_000_000;
      // Build up state and trigger a peak
      for (let i = 0; i < 10; i++) {
        recordReaction('s1', now + i * 1000);
      }

      clearSession('s1');

      // After clearing, should behave like a fresh session
      // Cold start with 8+ reactions should trigger peak
      const freshStart = now + 20_000;
      let peakDetected = false;
      for (let i = 0; i < MIN_REACTIONS_FOR_PEAK; i++) {
        if (recordReaction('s1', freshStart + i * 1000)) peakDetected = true;
      }
      expect(peakDetected).toBe(true);
    });
  });

  describe('baseline building over time', () => {
    it('reactions spread across 5 minutes build proper baseline, then sudden spike triggers peak', () => {
      const start = 1_000_000;
      // 2 reactions per 10s for 5 minutes = 60 reactions (low baseline)
      for (let i = 0; i < 60; i++) {
        const t = start + i * (BASELINE_WINDOW_MS / 60);
        recordReaction('s1', t);
      }

      // Sudden spike: 10 reactions in 10s
      // Baseline rate = (60 / 300_000) * 10_000 = 2 per window
      // Need >= 2 * 3.0 = 6 AND >= 8 (MIN). 10 >= both → peak
      // But we need to account for the spike reactions being added to baseline total
      const spikeStart = start + BASELINE_WINDOW_MS + 1;
      let peakDetected = false;
      for (let i = 0; i < 10; i++) {
        if (recordReaction('s1', spikeStart + i * 900)) peakDetected = true;
      }
      expect(peakDetected).toBe(true);
    });
  });

  describe('session isolation', () => {
    it('peak detection in session A does not affect session B', () => {
      const now = 1_000_000;
      // Trigger peak in session A (cold start, 10 reactions)
      let peakA = false;
      for (let i = 0; i < 10; i++) {
        if (recordReaction('sA', now + i * 1000)) peakA = true;
      }
      expect(peakA).toBe(true);

      // Session B should still be fresh — 8 reactions triggers peak independently
      let peakB = false;
      for (let i = 0; i < MIN_REACTIONS_FOR_PEAK; i++) {
        if (recordReaction('sB', now + i * 1000)) peakB = true;
      }
      expect(peakB).toBe(true);

      // Session A is in cooldown, session B should also be in cooldown now
      expect(recordReaction('sA', now + 15_000)).toBe(false);
      expect(recordReaction('sB', now + 15_000)).toBe(false);
    });
  });

  describe('resetLastPeak', () => {
    it('allows peak detection again after reset even within cooldown window', () => {
      const now = 1_000_000;
      // Trigger peak (cold start)
      let peakDetected = false;
      for (let i = 0; i < 10; i++) {
        if (recordReaction('s1', now + i * 1000)) peakDetected = true;
      }
      expect(peakDetected).toBe(true);

      // Within cooldown — should be suppressed
      expect(recordReaction('s1', now + 15_000)).toBe(false);

      // Reset cooldown
      resetLastPeak('s1');

      // Now a burst should trigger peak again (cold-start-like since timestamps are still there)
      peakDetected = false;
      for (let i = 0; i < 10; i++) {
        if (recordReaction('s1', now + 20_000 + i * 500)) peakDetected = true;
      }
      expect(peakDetected).toBe(true);
    });

    it('is a no-op for non-existent sessions', () => {
      // Should not throw
      resetLastPeak('nonexistent');
    });
  });

  describe('clearAllSessions', () => {
    it('clears state for all sessions', () => {
      const now = 1_000_000;
      // Build state in two sessions and trigger peaks
      for (let i = 0; i < 10; i++) {
        recordReaction('s1', now + i * 1000);
        recordReaction('s2', now + i * 1000);
      }

      clearAllSessions();

      // Both sessions should start fresh — cold start peaks should work
      let peakS1 = false;
      let peakS2 = false;
      const fresh = now + 100_000;
      for (let i = 0; i < MIN_REACTIONS_FOR_PEAK; i++) {
        if (recordReaction('s1', fresh + i * 1000)) peakS1 = true;
        if (recordReaction('s2', fresh + i * 1000)) peakS2 = true;
      }
      expect(peakS1).toBe(true);
      expect(peakS2).toBe(true);
    });
  });
});
