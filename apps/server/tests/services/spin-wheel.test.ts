import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  startRound,
  initiateSpin,
  onSpinComplete,
  startVetoWindow,
  handleVeto,
  resolveRound,
  autoSpin,
  getRound,
  clearRound,
  resetAllRounds,
} from '../../src/services/spin-wheel.js';
import type { SpinWheelSegment } from '../../src/services/spin-wheel.js';

function createTestSegment(overrides?: Partial<SpinWheelSegment>): SpinWheelSegment {
  const index = overrides?.segmentIndex ?? 0;
  return {
    catalogTrackId: overrides?.catalogTrackId ?? `cat-${index}`,
    songTitle: overrides?.songTitle ?? `Song ${index}`,
    artist: overrides?.artist ?? `Artist ${index}`,
    youtubeVideoId: overrides?.youtubeVideoId ?? `yt_${index}`,
    overlapCount: overrides?.overlapCount ?? 1,
    segmentIndex: index,
  };
}

function createTestSegments(count: number = 8): SpinWheelSegment[] {
  return Array.from({ length: count }, (_, i) =>
    createTestSegment({ segmentIndex: i, catalogTrackId: `song-${i}`, songTitle: `Song ${i}`, artist: `Artist ${i}` }),
  );
}

describe('spin-wheel service', () => {
  afterEach(() => {
    resetAllRounds();
  });

  describe('startRound', () => {
    it('creates round in waiting state with 8 segments', () => {
      const segments = createTestSegments(8);
      const round = startRound('session-1', segments);

      expect(round.sessionId).toBe('session-1');
      expect(round.segments).toHaveLength(8);
      expect(round.state).toBe('waiting');
      expect(round.spinnerUserId).toBeNull();
      expect(round.targetSegmentIndex).toBeNull();
      expect(round.vetoUsed).toBe(false);
      expect(round.vetoedSegmentIndex).toBeNull();
      expect(round.spinTimerHandle).toBeNull();
      expect(round.vetoTimerHandle).toBeNull();
    });
  });

  describe('initiateSpin', () => {
    it('returns spin params with valid rotation and duration', () => {
      startRound('session-1', createTestSegments(8));

      const result = initiateSpin('session-1', 'user-1');

      expect(result).not.toBeNull();
      expect(result!.targetSegmentIndex).toBeGreaterThanOrEqual(0);
      expect(result!.targetSegmentIndex).toBeLessThan(8);
      expect(result!.totalRotationRadians).toBeGreaterThan(0);
      expect(result!.spinDurationMs).toBe(4000);
    });

    it('stores spinnerUserId and targetSegmentIndex', () => {
      startRound('session-1', createTestSegments(8));

      const result = initiateSpin('session-1', 'user-1');

      const round = getRound('session-1')!;
      expect(round.spinnerUserId).toBe('user-1');
      expect(round.targetSegmentIndex).toBe(result!.targetSegmentIndex);
    });

    it('transitions state to spinning', () => {
      startRound('session-1', createTestSegments(8));

      initiateSpin('session-1', 'user-1');

      const round = getRound('session-1')!;
      expect(round.state).toBe('spinning');
    });

    it('returns null when round not in waiting state (prevents double-spin)', () => {
      startRound('session-1', createTestSegments(8));
      initiateSpin('session-1', 'user-1'); // now spinning

      const result = initiateSpin('session-1', 'user-2');
      expect(result).toBeNull();
    });

    it('returns null for non-existent session', () => {
      const result = initiateSpin('nonexistent', 'user-1');
      expect(result).toBeNull();
    });
  });

  describe('onSpinComplete', () => {
    it('transitions to landed and returns target segment', () => {
      const segments = createTestSegments(8);
      startRound('session-1', segments);
      const spinResult = initiateSpin('session-1', 'user-1');

      const landedSegment = onSpinComplete('session-1');

      expect(landedSegment).not.toBeNull();
      expect(landedSegment!.segmentIndex).toBe(spinResult!.targetSegmentIndex);
      const round = getRound('session-1')!;
      expect(round.state).toBe('landed');
    });

    it('returns null for non-existent session', () => {
      const result = onSpinComplete('nonexistent');
      expect(result).toBeNull();
    });

    it('returns null when not in spinning state', () => {
      startRound('session-1', createTestSegments(8));
      // still in 'waiting' state
      const result = onSpinComplete('session-1');
      expect(result).toBeNull();
    });
  });

  describe('startVetoWindow', () => {
    it('transitions to vetoing', () => {
      startRound('session-1', createTestSegments(8));
      initiateSpin('session-1', 'user-1');
      onSpinComplete('session-1');

      startVetoWindow('session-1');

      const round = getRound('session-1')!;
      expect(round.state).toBe('vetoing');
    });

    it('does nothing when not in landed state', () => {
      startRound('session-1', createTestSegments(8));
      startVetoWindow('session-1');

      const round = getRound('session-1')!;
      expect(round.state).toBe('waiting');
    });
  });

  describe('handleVeto', () => {
    it('returns new spin params excluding vetoed segment', () => {
      const segments = createTestSegments(8);
      startRound('session-1', segments);
      initiateSpin('session-1', 'user-1');
      onSpinComplete('session-1');
      startVetoWindow('session-1');

      const round = getRound('session-1')!;
      const vetoedIndex = round.targetSegmentIndex!;

      const result = handleVeto('session-1', 'user-2');

      expect(result).not.toBeNull();
      expect(result!.newTargetSegmentIndex).not.toBe(vetoedIndex);
      expect(result!.totalRotationRadians).toBeGreaterThan(0);
      expect(result!.spinDurationMs).toBe(4000);
      expect(result!.vetoedSong.segmentIndex).toBe(vetoedIndex);
    });

    it('marks vetoUsed and transitions to spinning', () => {
      startRound('session-1', createTestSegments(8));
      initiateSpin('session-1', 'user-1');
      onSpinComplete('session-1');
      startVetoWindow('session-1');

      handleVeto('session-1', 'user-2');

      const round = getRound('session-1')!;
      expect(round.vetoUsed).toBe(true);
      expect(round.state).toBe('spinning');
    });

    it('returns null when vetoUsed === true', () => {
      startRound('session-1', createTestSegments(8));
      initiateSpin('session-1', 'user-1');
      onSpinComplete('session-1');
      startVetoWindow('session-1');

      handleVeto('session-1', 'user-2'); // first veto

      const result = handleVeto('session-1', 'user-3'); // second veto attempt
      expect(result).toBeNull();
    });

    it('returns null when round not in vetoing state', () => {
      startRound('session-1', createTestSegments(8));
      initiateSpin('session-1', 'user-1');
      // state is 'spinning', not 'vetoing'

      const result = handleVeto('session-1', 'user-2');
      expect(result).toBeNull();
    });

    it('picks target from remaining segments (not the vetoed one)', () => {
      // Test with only 2 segments to guarantee the new target is not the vetoed one
      const segments = createTestSegments(2);
      startRound('session-1', segments);
      initiateSpin('session-1', 'user-1');
      onSpinComplete('session-1');
      startVetoWindow('session-1');

      const round = getRound('session-1')!;
      const vetoedIndex = round.targetSegmentIndex!;

      const result = handleVeto('session-1', 'user-2');
      expect(result).not.toBeNull();
      expect(result!.newTargetSegmentIndex).not.toBe(vetoedIndex);
    });
  });

  describe('resolveRound', () => {
    it('transitions to resolved and returns target segment', () => {
      startRound('session-1', createTestSegments(8));
      const spinResult = initiateSpin('session-1', 'user-1');
      onSpinComplete('session-1');

      const selectedSegment = resolveRound('session-1');

      expect(selectedSegment).not.toBeNull();
      expect(selectedSegment!.segmentIndex).toBe(spinResult!.targetSegmentIndex);
      const round = getRound('session-1')!;
      expect(round.state).toBe('resolved');
    });

    it('returns null for non-existent session', () => {
      const result = resolveRound('nonexistent');
      expect(result).toBeNull();
    });
  });

  describe('autoSpin', () => {
    it('same as initiateSpin but null spinnerUserId', () => {
      startRound('session-1', createTestSegments(8));

      const result = autoSpin('session-1');

      expect(result).not.toBeNull();
      expect(result!.targetSegmentIndex).toBeGreaterThanOrEqual(0);
      expect(result!.targetSegmentIndex).toBeLessThan(8);
      expect(result!.totalRotationRadians).toBeGreaterThan(0);
      expect(result!.spinDurationMs).toBe(4000);

      const round = getRound('session-1')!;
      expect(round.spinnerUserId).toBeNull();
      expect(round.state).toBe('spinning');
    });

    it('returns null when not in waiting state', () => {
      startRound('session-1', createTestSegments(8));
      initiateSpin('session-1', 'user-1');

      const result = autoSpin('session-1');
      expect(result).toBeNull();
    });
  });

  describe('clearRound', () => {
    it('cancels timer handles and removes from map', () => {
      startRound('session-1', createTestSegments(8));
      const round = getRound('session-1')!;
      round.spinTimerHandle = setTimeout(() => {}, 10000);
      round.vetoTimerHandle = setTimeout(() => {}, 10000);

      clearRound('session-1');

      expect(getRound('session-1')).toBeUndefined();
    });

    it('safe to call for non-existent session', () => {
      expect(() => clearRound('nonexistent')).not.toThrow();
    });
  });

  describe('module isolation', () => {
    it('different sessions do not interfere', () => {
      startRound('session-1', createTestSegments(8));
      startRound('session-2', createTestSegments(8));

      initiateSpin('session-1', 'user-1');

      const round2 = getRound('session-2')!;
      expect(round2.state).toBe('waiting');
    });
  });

  describe('resetAllRounds', () => {
    it('clears all data', () => {
      startRound('session-1', createTestSegments(8));
      startRound('session-2', createTestSegments(8));

      resetAllRounds();

      expect(getRound('session-1')).toBeUndefined();
      expect(getRound('session-2')).toBeUndefined();
    });
  });

  describe('spin rotation calculation', () => {
    it('totalRotation includes target segment offset', () => {
      startRound('session-1', createTestSegments(8));

      const result = initiateSpin('session-1', 'user-1');
      expect(result).not.toBeNull();

      // Total rotation should be at least 5 full rotations
      const minRotation = 5 * 2 * Math.PI;
      expect(result!.totalRotationRadians).toBeGreaterThanOrEqual(minRotation);

      // Total rotation should be at most 8 full rotations + one segment angle
      const maxRotation = 9 * 2 * Math.PI; // 8 full + max segment offset < 1 full
      expect(result!.totalRotationRadians).toBeLessThan(maxRotation);
    });
  });
});
