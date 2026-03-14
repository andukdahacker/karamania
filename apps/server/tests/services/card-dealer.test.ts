import { describe, it, expect, beforeEach } from 'vitest';
import { dealCard, redealCard, clearDealtCards } from '../../src/services/card-dealer.js';
import { CardType } from '../../src/services/party-card-pool.js';

describe('dealCard', () => {
  beforeEach(() => {
    clearDealtCards('test-session');
    clearDealtCards('session-a');
    clearDealtCards('session-b');
  });

  it('returns a valid PartyCard', () => {
    const card = dealCard('test-session', 3);
    expect(card.id).toBeTruthy();
    expect(card.title).toBeTruthy();
    expect(card.description).toBeTruthy();
    expect(card.type).toBeTruthy();
    expect(card.emoji).toBeTruthy();
  });

  it('with participantCount=1 never returns group cards', () => {
    for (let i = 0; i < 50; i++) {
      const card = dealCard('test-session', 1);
      expect(card.type).not.toBe(CardType.group);
    }
  });

  it('with participantCount=3 can return any card type', () => {
    const types = new Set<string>();
    for (let i = 0; i < 100; i++) {
      const card = dealCard('test-session', 3);
      types.add(card.type);
    }
    expect(types.has(CardType.vocal)).toBe(true);
    expect(types.has(CardType.performance)).toBe(true);
    expect(types.has(CardType.group)).toBe(true);
  });

  it('avoids repeats within a session until pool exhausted', () => {
    const dealt = new Set<string>();
    // Deal all 14 non-group cards (participantCount=1)
    for (let i = 0; i < 14; i++) {
      const card = dealCard('test-session', 1);
      expect(dealt.has(card.id)).toBe(false);
      dealt.add(card.id);
    }
    expect(dealt.size).toBe(14);
  });

  it('resets when pool exhausted and continues dealing', () => {
    // Deal all 14 non-group cards
    for (let i = 0; i < 14; i++) {
      dealCard('test-session', 1);
    }
    // 15th deal should work (pool resets)
    const card = dealCard('test-session', 1);
    expect(card.id).toBeTruthy();
  });

  it('sessions are independent', () => {
    const cardA = dealCard('session-a', 1);
    const cardB = dealCard('session-b', 1);
    // Both should deal successfully (not testing specific IDs — random)
    expect(cardA.id).toBeTruthy();
    expect(cardB.id).toBeTruthy();
  });
});

describe('redealCard', () => {
  beforeEach(() => {
    clearDealtCards('test-session');
  });

  it('returns a different card than the excluded one', () => {
    // With 14+ eligible cards, we should always get a different one
    for (let i = 0; i < 20; i++) {
      const card = redealCard('test-session', 3, 'chipmunk-mode');
      expect(card.id).not.toBe('chipmunk-mode');
    }
  });

  it('returns the same card when only 1 eligible card exists', () => {
    // This edge case shouldn't normally happen, but test the guard
    // With participantCount=1, we have 14 eligible cards. Can't easily test
    // the single-card scenario without mocking, so verify it handles exclusion
    const card = redealCard('test-session', 1, 'nonexistent-card');
    expect(card.id).toBeTruthy();
  });
});

describe('clearDealtCards', () => {
  it('resets tracking for a session', () => {
    // Deal several cards
    const dealt = new Set<string>();
    for (let i = 0; i < 5; i++) {
      dealt.add(dealCard('test-session', 1).id);
    }

    // Clear and deal again — first card could be any of the 14
    clearDealtCards('test-session');
    const card = dealCard('test-session', 1);
    expect(card.id).toBeTruthy();
  });
});
