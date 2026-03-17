import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import {
  shouldEmitCaptureBubble,
  markBubbleEmitted,
  clearCaptureTriggerState,
} from '../../src/services/capture-trigger.js';
import { DJState } from '../../src/dj-engine/types.js';

describe('capture-trigger', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    clearCaptureTriggerState('session-1');
    clearCaptureTriggerState('session-2');
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('shouldEmitCaptureBubble', () => {
    it('returns true on first call for a session', () => {
      expect(shouldEmitCaptureBubble('session-1')).toBe(true);
    });

    it('returns false within 60s cooldown after markBubbleEmitted', () => {
      markBubbleEmitted('session-1');
      vi.advanceTimersByTime(30_000);
      expect(shouldEmitCaptureBubble('session-1')).toBe(false);
    });

    it('returns true after 60s cooldown expires', () => {
      markBubbleEmitted('session-1');
      vi.advanceTimersByTime(60_001);
      expect(shouldEmitCaptureBubble('session-1')).toBe(true);
    });

    it('resets cooldown after clearCaptureTriggerState', () => {
      markBubbleEmitted('session-1');
      clearCaptureTriggerState('session-1');
      expect(shouldEmitCaptureBubble('session-1')).toBe(true);
    });

    it('tracks sessions independently', () => {
      markBubbleEmitted('session-1');
      expect(shouldEmitCaptureBubble('session-1')).toBe(false);
      expect(shouldEmitCaptureBubble('session-2')).toBe(true);
    });

    it('returns false when currentState is ceremony', () => {
      expect(shouldEmitCaptureBubble('session-1', DJState.ceremony)).toBe(false);
    });

    it('returns true when currentState is song', () => {
      expect(shouldEmitCaptureBubble('session-1', DJState.song)).toBe(true);
    });

    it('returns true when currentState is finale', () => {
      expect(shouldEmitCaptureBubble('session-1', DJState.finale)).toBe(true);
    });

    it('returns true when currentState is undefined', () => {
      expect(shouldEmitCaptureBubble('session-1', undefined)).toBe(true);
    });
  });
});
