import { describe, it, expect } from 'vitest';
import { PARTY_CARDS, getEligibleCards, CardType } from '../../src/services/party-card-pool.js';

describe('PARTY_CARDS', () => {
  it('contains exactly 19 cards', () => {
    expect(PARTY_CARDS).toHaveLength(19);
  });

  it('has 7 vocal cards', () => {
    const vocal = PARTY_CARDS.filter(c => c.type === CardType.vocal);
    expect(vocal).toHaveLength(7);
  });

  it('has 7 performance cards', () => {
    const performance = PARTY_CARDS.filter(c => c.type === CardType.performance);
    expect(performance).toHaveLength(7);
  });

  it('has 5 group cards', () => {
    const group = PARTY_CARDS.filter(c => c.type === CardType.group);
    expect(group).toHaveLength(5);
  });

  it('has all unique card IDs', () => {
    const ids = PARTY_CARDS.map(c => c.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('all cards have required fields', () => {
    for (const card of PARTY_CARDS) {
      expect(card.id).toBeTruthy();
      expect(card.title).toBeTruthy();
      expect(card.description).toBeTruthy();
      expect(card.type).toBeTruthy();
      expect(card.emoji).toBeTruthy();
      expect(typeof card.minParticipants).toBe('number');
    }
  });

  it('all vocal/performance cards have minParticipants 1', () => {
    const nonGroup = PARTY_CARDS.filter(c => c.type !== CardType.group);
    for (const card of nonGroup) {
      expect(card.minParticipants).toBe(1);
    }
  });

  it('all group cards have minParticipants 3', () => {
    const group = PARTY_CARDS.filter(c => c.type === CardType.group);
    for (const card of group) {
      expect(card.minParticipants).toBe(3);
    }
  });
});

describe('getEligibleCards', () => {
  it('returns only vocal + performance cards for participantCount 1', () => {
    const eligible = getEligibleCards(1);
    expect(eligible).toHaveLength(14);
    expect(eligible.every(c => c.type !== CardType.group)).toBe(true);
  });

  it('returns only vocal + performance cards for participantCount 2', () => {
    const eligible = getEligibleCards(2);
    expect(eligible).toHaveLength(14);
    expect(eligible.every(c => c.type !== CardType.group)).toBe(true);
  });

  it('returns all 19 cards for participantCount 3', () => {
    const eligible = getEligibleCards(3);
    expect(eligible).toHaveLength(19);
  });

  it('returns all 19 cards for participantCount > 3', () => {
    const eligible = getEligibleCards(10);
    expect(eligible).toHaveLength(19);
  });
});
