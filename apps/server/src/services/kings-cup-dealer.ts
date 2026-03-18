// Kings Cup card pool and dealer — group rule cards for interlude games
// Same module-level Map pattern as activity-voter.ts, quick-pick.ts

export interface KingsCupCard {
  id: string;
  title: string;
  rule: string;
  emoji: string;
}

export const KINGS_CUP_CARDS: readonly KingsCupCard[] = [
  { id: 'group-toast', title: 'Group Toast!', rule: 'Everyone raises their phone and cheers together!', emoji: '🥂' },
  { id: 'accent-round', title: 'Accent Round', rule: 'Everyone must speak in a silly accent until the next song starts', emoji: '🌍' },
  { id: 'compliment-circle', title: 'Compliment Circle', rule: 'Each person compliments the person to their left', emoji: '💬' },
  { id: 'freeze-frame', title: 'Freeze!', rule: 'Strike a pose — last person to freeze picks the next song', emoji: '🧊' },
  { id: 'story-time', title: 'Story Time', rule: 'Go around adding one word each to create a group story', emoji: '📖' },
  { id: 'silent-disco', title: 'Silent Disco', rule: 'Everyone dances in silence for 10 seconds — no music, just vibes', emoji: '🤫' },
  { id: 'mirror-mirror', title: 'Mirror Mirror', rule: 'Copy exactly what the person across from you does', emoji: '🪞' },
  { id: 'thumb-master', title: 'Thumb Master', rule: 'Last person to put their thumb on the table picks the next singer', emoji: '👍' },
  { id: 'never-have-i', title: 'Never Have I Ever', rule: 'Everyone holds up 3 fingers — take turns saying things, lower a finger if you have done it', emoji: '✋' },
  { id: 'hype-train', title: 'Hype Train', rule: 'Everyone must hype up the last singer with their best compliment', emoji: '🚂' },
  { id: 'category-king', title: 'Category King', rule: 'Name a category — go around naming things in it. First person who hesitates loses!', emoji: '👑' },
  { id: 'sing-it-back', title: 'Sing It Back', rule: 'The group must sing the chorus of the last song together from memory', emoji: '🎤' },
  { id: 'phone-stack', title: 'Phone Stack', rule: 'Everyone stacks their phones — first person to grab theirs picks the next song', emoji: '📱' },
  { id: 'air-guitar-battle', title: 'Air Guitar Battle', rule: 'Everyone plays air guitar — group votes on the best performance', emoji: '🎸' },
  { id: 'rhyme-time', title: 'Rhyme Time', rule: 'Say a word — go around the circle rhyming it. First person who can\'t think of one loses!', emoji: '🔤' },
  { id: 'dance-off', title: 'Dance Off', rule: 'Everyone does their best dance move — the group crowns a winner', emoji: '💃' },
  { id: 'truth-bomb', title: 'Truth Bomb', rule: 'Everyone shares one surprising truth about themselves', emoji: '💣' },
  { id: 'high-five-chain', title: 'High Five Chain', rule: 'Start a high-five chain — everyone must high-five the person next to them in sequence', emoji: '🙌' },
] as const;

// Track last dealt card per session to avoid immediate repeats
const lastDealtCard = new Map<string, string>();

/**
 * Deal a random card from the pool, avoiding immediate repeats per session.
 */
export function dealCard(sessionId: string): KingsCupCard {
  const lastId = lastDealtCard.get(sessionId);
  let eligible = KINGS_CUP_CARDS.filter(c => c.id !== lastId);

  // Fallback: if filtering leaves nothing (shouldn't happen with 18 cards), use full pool
  if (eligible.length === 0) {
    eligible = [...KINGS_CUP_CARDS];
  }

  const index = Math.floor(Math.random() * eligible.length);
  const card = eligible[index]!;
  lastDealtCard.set(sessionId, card.id);
  return card;
}

/**
 * Clear last-dealt tracking for a session.
 */
export function clearSession(sessionId: string): void {
  lastDealtCard.delete(sessionId);
}

/**
 * Test utility — clear all session data.
 */
export function resetAll(): void {
  lastDealtCard.clear();
}
