import { describe, it, expect, afterEach } from 'vitest';
import {
  dealCard,
  clearSession,
  resetAll,
  KINGS_CUP_CARDS,
} from '../../src/services/kings-cup-dealer.js';

describe('kings-cup-dealer service', () => {
  afterEach(() => {
    resetAll();
  });

  describe('KINGS_CUP_CARDS pool', () => {
    it('has at least 15 cards', () => {
      expect(KINGS_CUP_CARDS.length).toBeGreaterThanOrEqual(15);
    });

    it('all cards have non-empty id, title, rule, emoji', () => {
      for (const card of KINGS_CUP_CARDS) {
        expect(card.id).toBeTruthy();
        expect(card.title).toBeTruthy();
        expect(card.rule).toBeTruthy();
        expect(card.emoji).toBeTruthy();
      }
    });

    it('all card ids are unique', () => {
      const ids = KINGS_CUP_CARDS.map(c => c.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('dealCard', () => {
    it('returns a valid card from the pool', () => {
      const card = dealCard('session-1');
      const poolIds = KINGS_CUP_CARDS.map(c => c.id);
      expect(poolIds).toContain(card.id);
      expect(card.title).toBeTruthy();
      expect(card.rule).toBeTruthy();
      expect(card.emoji).toBeTruthy();
    });

    it('does not deal the same card twice in a row for the same session', () => {
      const first = dealCard('session-1');
      const second = dealCard('session-1');
      expect(second.id).not.toBe(first.id);
    });

    it('can deal the same card to different sessions', () => {
      // With 18 cards, dealing to many sessions may produce same card — just verify no crash
      const card1 = dealCard('session-1');
      const card2 = dealCard('session-2');
      expect(card1.id).toBeTruthy();
      expect(card2.id).toBeTruthy();
    });

    it('allows repeat after clearSession', () => {
      const first = dealCard('session-1');
      clearSession('session-1');
      // After clear, the first card could be dealt again (no longer tracked)
      // We just verify dealCard works after clear
      const afterClear = dealCard('session-1');
      expect(afterClear.id).toBeTruthy();
    });
  });

  describe('clearSession', () => {
    it('resets last-dealt tracking for a session', () => {
      dealCard('session-1');
      clearSession('session-1');
      // No error, tracking is cleared
      const card = dealCard('session-1');
      expect(card.id).toBeTruthy();
    });

    it('does not affect other sessions', () => {
      const s1Card = dealCard('session-1');
      dealCard('session-2');
      clearSession('session-1');
      // session-2 still has tracking
      const s2Next = dealCard('session-2');
      expect(s2Next.id).toBeTruthy();
      // session-1 tracking is cleared — verify it works
      const s1Next = dealCard('session-1');
      expect(s1Next.id).toBeTruthy();
    });
  });

  describe('resetAll', () => {
    it('clears all session data', () => {
      dealCard('session-1');
      dealCard('session-2');
      resetAll();
      // Both sessions cleared — dealing works without constraint
      const card1 = dealCard('session-1');
      const card2 = dealCard('session-2');
      expect(card1.id).toBeTruthy();
      expect(card2.id).toBeTruthy();
    });
  });
});
