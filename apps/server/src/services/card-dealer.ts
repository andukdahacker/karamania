import { getEligibleCards } from './party-card-pool.js';
import type { PartyCard } from './party-card-pool.js';

// Track dealt cards per session to avoid repeats until pool exhausted
const sessionDealtCards = new Map<string, Set<string>>();

/**
 * Deal a random card from the eligible pool, avoiding recently dealt cards.
 * When all eligible cards have been dealt, resets the tracking and starts fresh.
 */
export function dealCard(sessionId: string, participantCount: number): PartyCard {
  const eligible = getEligibleCards(participantCount);
  const dealt = sessionDealtCards.get(sessionId) ?? new Set<string>();

  // Filter out already-dealt cards
  let available = eligible.filter(card => !dealt.has(card.id));

  // If all eligible cards dealt, reset and use full eligible pool
  if (available.length === 0) {
    dealt.clear();
    available = eligible;
  }

  // Random selection
  const index = Math.floor(Math.random() * available.length);
  const card = available[index]!;

  // Track dealt card
  dealt.add(card.id);
  sessionDealtCards.set(sessionId, dealt);

  return card;
}

/**
 * Deal a specific card (for host override re-deal — excludes the current card).
 */
export function redealCard(sessionId: string, participantCount: number, excludeCardId: string): PartyCard {
  const eligible = getEligibleCards(participantCount);
  const available = eligible.filter(card => card.id !== excludeCardId);

  if (available.length === 0) {
    // Only one eligible card — return it (same card)
    return eligible[0]!;
  }

  const index = Math.floor(Math.random() * available.length);
  const card = available[index]!;

  // Track dealt card
  const dealt = sessionDealtCards.get(sessionId) ?? new Set<string>();
  dealt.add(card.id);
  sessionDealtCards.set(sessionId, dealt);

  return card;
}

/**
 * Clear dealt card tracking for a session (on session end).
 */
export function clearDealtCards(sessionId: string): void {
  sessionDealtCards.delete(sessionId);
}
