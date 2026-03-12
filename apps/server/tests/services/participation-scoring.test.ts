import { describe, it, expect } from 'vitest';
import {
  calculateScoreIncrement,
  ParticipationTier,
  TIER_POINTS,
  ACTION_TIER_MAP,
} from '../../src/services/participation-scoring.js';

describe('participation-scoring', () => {
  describe('constants', () => {
    it('defines three tiers with correct point values', () => {
      expect(TIER_POINTS.passive).toBe(1);
      expect(TIER_POINTS.active).toBe(3);
      expect(TIER_POINTS.engaged).toBe(5);
    });

    it('ParticipationTier and TIER_POINTS keys are consistent', () => {
      const tierValues = Object.values(ParticipationTier);
      const pointKeys = Object.keys(TIER_POINTS);
      expect(tierValues.sort()).toEqual(pointKeys.sort());
    });

    it('all ACTION_TIER_MAP values are valid tiers', () => {
      const validTiers = Object.values(ParticipationTier);
      for (const tier of Object.values(ACTION_TIER_MAP)) {
        expect(validTiers).toContain(tier);
      }
    });
  });

  describe('ACTION_TIER_MAP', () => {
    it('maps passive actions correctly', () => {
      expect(ACTION_TIER_MAP['party:joined']).toBe('passive');
      expect(ACTION_TIER_MAP['session:present']).toBe('passive');
    });

    it('maps active actions correctly', () => {
      expect(ACTION_TIER_MAP['party:vibeChanged']).toBe('active');
      expect(ACTION_TIER_MAP['reaction:sent']).toBe('active');
      expect(ACTION_TIER_MAP['sound:play']).toBe('active');
    });

    it('maps engaged actions correctly', () => {
      expect(ACTION_TIER_MAP['card:accepted']).toBe('engaged');
      expect(ACTION_TIER_MAP['card:completed']).toBe('engaged');
      expect(ACTION_TIER_MAP['song:queued']).toBe('engaged');
    });
  });

  describe('calculateScoreIncrement', () => {
    it('returns correct points for passive tier (1pt)', () => {
      expect(calculateScoreIncrement('party:joined')).toBe(1);
    });

    it('returns correct points for active tier (3pts)', () => {
      expect(calculateScoreIncrement('party:vibeChanged')).toBe(3);
    });

    it('returns correct points for engaged tier (5pts)', () => {
      expect(calculateScoreIncrement('card:accepted')).toBe(5);
    });

    it('returns 0 for unknown action', () => {
      expect(calculateScoreIncrement('unknown:action')).toBe(0);
    });

    it('applies rewardMultiplier correctly (0.5 = half points, rounded)', () => {
      expect(calculateScoreIncrement('party:vibeChanged', 0.5)).toBe(2); // 3 * 0.5 = 1.5 → 2
      expect(calculateScoreIncrement('party:joined', 0.5)).toBe(1); // 1 * 0.5 = 0.5 → 1
      expect(calculateScoreIncrement('card:accepted', 0.5)).toBe(3); // 5 * 0.5 = 2.5 → 3
    });

    it('returns 0 when rewardMultiplier is 0', () => {
      expect(calculateScoreIncrement('party:joined', 0)).toBe(0);
      expect(calculateScoreIncrement('party:vibeChanged', 0)).toBe(0);
      expect(calculateScoreIncrement('card:accepted', 0)).toBe(0);
    });

    it('returns 0 for unknown action even with multiplier', () => {
      expect(calculateScoreIncrement('unknown:action', 2.0)).toBe(0);
    });

    it('handles multiplier greater than 1', () => {
      expect(calculateScoreIncrement('party:joined', 2.0)).toBe(2); // 1 * 2 = 2
      expect(calculateScoreIncrement('party:vibeChanged', 1.5)).toBe(5); // 3 * 1.5 = 4.5 → 5
    });
  });
});
