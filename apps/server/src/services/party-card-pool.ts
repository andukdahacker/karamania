export const CardType = {
  vocal: 'vocal',
  performance: 'performance',
  group: 'group',
} as const;
export type CardType = (typeof CardType)[keyof typeof CardType];

export interface PartyCard {
  id: string;
  title: string;
  description: string;
  type: CardType;
  emoji: string;
  minParticipants: number; // 1 for vocal/performance, 3 for group
}

export const PARTY_CARDS: readonly PartyCard[] = [
  // Vocal Modifier Cards (7) — FR56
  { id: 'chipmunk-mode', title: 'Chipmunk Mode', description: 'Sing in the highest pitch you can manage', type: CardType.vocal, emoji: '🐿️', minParticipants: 1 },
  { id: 'barry-white', title: 'Barry White', description: 'Channel your deepest, smoothest bass voice', type: CardType.vocal, emoji: '🎵', minParticipants: 1 },
  { id: 'the-whisperer', title: 'The Whisperer', description: 'Perform the entire song in a dramatic whisper', type: CardType.vocal, emoji: '🤫', minParticipants: 1 },
  { id: 'robot-mode', title: 'Robot Mode', description: 'Sing like a malfunctioning robot — monotone and glitchy', type: CardType.vocal, emoji: '🤖', minParticipants: 1 },
  { id: 'opera-singer', title: 'Opera Singer', description: 'Give it full operatic vibrato and drama', type: CardType.vocal, emoji: '🎭', minParticipants: 1 },
  { id: 'accent-roulette', title: 'Accent Roulette', description: 'Pick a random accent and commit to it for the whole song', type: CardType.vocal, emoji: '🌍', minParticipants: 1 },
  { id: 'beatboxer', title: 'Beatboxer', description: 'Add beatbox sounds between lyrics', type: CardType.vocal, emoji: '🥁', minParticipants: 1 },

  // Performance Modifier Cards (7) — FR57
  { id: 'blind-karaoke', title: 'Blind Karaoke', description: 'Close your eyes — no peeking at lyrics!', type: CardType.performance, emoji: '🙈', minParticipants: 1 },
  { id: 'method-actor', title: 'Method Actor', description: 'Act out every lyric with full dramatic commitment', type: CardType.performance, emoji: '🎬', minParticipants: 1 },
  { id: 'the-statue', title: 'The Statue', description: 'Sing without moving your body at all — freeze!', type: CardType.performance, emoji: '🗿', minParticipants: 1 },
  { id: 'slow-motion', title: 'Slow Motion', description: 'Move in slow motion while singing at normal speed', type: CardType.performance, emoji: '🐌', minParticipants: 1 },
  { id: 'the-drunk-uncle', title: 'The Drunk Uncle', description: 'Perform like the lovable relative at a wedding who insists on karaoke', type: CardType.performance, emoji: '🍺', minParticipants: 1 },
  { id: 'news-anchor', title: 'News Anchor', description: 'Deliver the song like you\'re reading breaking news', type: CardType.performance, emoji: '📺', minParticipants: 1 },
  { id: 'interpretive-dance', title: 'Interpretive Dance', description: 'Express every emotion through interpretive dance while singing', type: CardType.performance, emoji: '💃', minParticipants: 1 },

  // Group Involvement Cards (5) — FR58
  { id: 'name-that-tune', title: 'Name That Tune', description: 'Hum the first few bars — audience guesses the song before you sing', type: CardType.group, emoji: '🎶', minParticipants: 3 },
  { id: 'backup-dancers', title: 'Backup Dancers', description: 'Random audience members become your backup dancers', type: CardType.group, emoji: '🕺', minParticipants: 3 },
  { id: 'crowd-conductor', title: 'Crowd Conductor', description: 'You control when the audience claps, waves, or cheers', type: CardType.group, emoji: '🎼', minParticipants: 3 },
  { id: 'tag-team', title: 'Tag Team', description: 'A random participant joins you — alternate verses!', type: CardType.group, emoji: '🏷️', minParticipants: 3 },
  { id: 'hype-squad', title: 'Hype Squad', description: 'Random participants must hype you up throughout the song', type: CardType.group, emoji: '📣', minParticipants: 3 },
] as const;

/**
 * Get eligible cards for the current participant count.
 * Filters out group cards when < 3 participants (NFR12).
 */
export function getEligibleCards(participantCount: number): PartyCard[] {
  return PARTY_CARDS.filter(card => participantCount >= card.minParticipants);
}
