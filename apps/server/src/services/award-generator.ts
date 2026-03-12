export const AwardTone = {
  comedic: 'comedic',
  hype: 'hype',
  absurd: 'absurd',
  wholesome: 'wholesome',
} as const;
export type AwardTone = (typeof AwardTone)[keyof typeof AwardTone];

export interface AwardTemplate {
  title: string;
  tone: AwardTone;
  /** Optional context affinity — boosts selection weight when context matches */
  affinity?: {
    /** Prefer when card was completed during song */
    cardCompleted?: boolean;
    /** Prefer when reaction volume was high */
    highReactions?: boolean;
    /** Prefer for early songs (position <= 3) */
    earlySong?: boolean;
    /** Prefer for late session songs (position >= 6) */
    lateSong?: boolean;
    /** Prefer for high participation score performers */
    highScore?: boolean;
  };
}

export interface AwardContext {
  /** Song position in session (1-based) */
  songPosition: number;
  /** Whether performer completed a party card challenge during the song */
  cardCompleted: boolean;
  /** Number of reactions received during the song (approximation from event stream) */
  reactionCount: number;
  /** Performer's cumulative participation score */
  participationScore: number;
  /** Total participant count (for relative scoring) */
  participantCount: number;
  /** Previously awarded titles this session — for dedup */
  previousAwards: string[];
}

export const AWARD_TEMPLATES: AwardTemplate[] = [
  // Comedic (6+)
  { title: 'Vocal Menace', tone: AwardTone.comedic },
  { title: 'The Whisperer', tone: AwardTone.comedic, affinity: { lateSong: true } },
  { title: 'Certified Unhinged', tone: AwardTone.comedic, affinity: { highReactions: true } },
  { title: 'Mic Crime Suspect', tone: AwardTone.comedic },
  { title: 'Delightfully Off-Key', tone: AwardTone.comedic, affinity: { earlySong: true } },
  { title: 'Voice of Chaos', tone: AwardTone.comedic, affinity: { cardCompleted: true } },

  // Hype (6+)
  { title: 'Vocal Assassin', tone: AwardTone.hype, affinity: { highReactions: true } },
  { title: 'Main Character Energy', tone: AwardTone.hype, affinity: { highScore: true } },
  { title: 'Stage Commander', tone: AwardTone.hype, affinity: { earlySong: true } },
  { title: 'The Headliner', tone: AwardTone.hype, affinity: { lateSong: true } },
  { title: 'Crowd Controller', tone: AwardTone.hype, affinity: { highReactions: true } },
  { title: 'Pure Fire', tone: AwardTone.hype },

  // Absurd (6+)
  { title: 'Interdimensional Vocalist', tone: AwardTone.absurd },
  { title: 'Karaoke Cryptid', tone: AwardTone.absurd, affinity: { lateSong: true } },
  { title: 'Legally Questionable Talent', tone: AwardTone.absurd, affinity: { cardCompleted: true } },
  { title: 'Vocal Sorcery Detected', tone: AwardTone.absurd, affinity: { highReactions: true } },
  { title: 'Unregistered Bard', tone: AwardTone.absurd },
  { title: 'The Enigma', tone: AwardTone.absurd, affinity: { highScore: true } },

  // Wholesome (6+)
  { title: 'Heart of the Party', tone: AwardTone.wholesome, affinity: { highScore: true } },
  { title: 'The Warm-Up Act', tone: AwardTone.wholesome, affinity: { earlySong: true } },
  { title: 'Joy Bringer', tone: AwardTone.wholesome },
  { title: 'Golden Moment', tone: AwardTone.wholesome, affinity: { highReactions: true } },
  { title: 'Everyone Felt That', tone: AwardTone.wholesome, affinity: { cardCompleted: true } },
  { title: 'Soul of the Session', tone: AwardTone.wholesome, affinity: { lateSong: true } },
];

export const BASE_WEIGHT = 1;
export const AFFINITY_BOOST = 2;
export const EARLY_SONG_THRESHOLD = 3;
export const LATE_SONG_THRESHOLD = 6;
export const HIGH_SCORE_THRESHOLD = 15;

export function calculateWeight(template: AwardTemplate, context: AwardContext): number {
  let weight = BASE_WEIGHT;
  const a = template.affinity;
  if (!a) return weight;

  if (a.cardCompleted && context.cardCompleted) weight += AFFINITY_BOOST;
  if (a.highReactions && context.reactionCount >= context.participantCount * 2) weight += AFFINITY_BOOST;
  if (a.earlySong && context.songPosition <= EARLY_SONG_THRESHOLD) weight += AFFINITY_BOOST;
  if (a.lateSong && context.songPosition >= LATE_SONG_THRESHOLD) weight += AFFINITY_BOOST;
  if (a.highScore && context.participationScore >= HIGH_SCORE_THRESHOLD) weight += AFFINITY_BOOST;

  return weight;
}

function weightedRandomSelect(
  items: { template: AwardTemplate; weight: number }[],
  randomFn: () => number,
): { template: AwardTemplate; weight: number } {
  const totalWeight = items.reduce((sum, item) => sum + item.weight, 0);
  let random = randomFn() * totalWeight;
  for (const item of items) {
    random -= item.weight;
    if (random <= 0) return item;
  }
  return items[items.length - 1]!;
}

export function generateAward(
  context: AwardContext,
  randomFn: () => number = Math.random,
): string {
  // 1. Score each template based on context affinity matches
  const scored = AWARD_TEMPLATES
    .filter(t => !context.previousAwards.includes(t.title))
    .map(t => ({
      template: t,
      weight: calculateWeight(t, context),
    }));

  // 2. If all templates exhausted (>24 songs!), allow repeats
  const candidates = scored.length > 0
    ? scored
    : AWARD_TEMPLATES.map(t => ({ template: t, weight: calculateWeight(t, context) }));

  // 3. Weighted random selection
  return weightedRandomSelect(candidates, randomFn).template.title;
}
