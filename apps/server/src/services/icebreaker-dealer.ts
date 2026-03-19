// Icebreaker question pool, dealer, and vote tally — first-session icebreaker activity
// Same module-level Map pattern as quick-vote-dealer.ts

export interface IcebreakerOption {
  id: string;
  label: string;
  emoji: string;
}

export interface IcebreakerQuestion {
  id: string;
  question: string;
  options: readonly IcebreakerOption[];
}

export const ICEBREAKER_QUESTIONS: readonly IcebreakerQuestion[] = [
  {
    id: 'fav-decade',
    question: "What's your music decade?",
    options: [
      { id: '80s', label: '80s', emoji: '🕺' },
      { id: '90s', label: '90s', emoji: '💿' },
      { id: '2000s', label: '2000s', emoji: '📀' },
      { id: '2010s', label: '2010s+', emoji: '🎧' },
    ],
  },
  {
    id: 'karaoke-anthem',
    question: "Tonight's karaoke anthem will be...",
    options: [
      { id: 'ballad', label: 'A power ballad', emoji: '🎤' },
      { id: 'regret', label: "Something we'll regret", emoji: '😅' },
      { id: 'banger', label: 'A dance banger', emoji: '💃' },
      { id: 'emotional', label: 'An emotional wreck', emoji: '😭' },
    ],
  },
  {
    id: 'karaoke-style',
    question: 'Your karaoke style is...',
    options: [
      { id: 'shower', label: 'Shower singer', emoji: '🚿' },
      { id: 'rockstar', label: 'Secret rockstar', emoji: '🎸' },
      { id: 'backup', label: 'Backup dancer', emoji: '💃' },
      { id: 'audience', label: 'Professional audience', emoji: '👏' },
    ],
  },
  {
    id: 'first-song-genre',
    question: 'First song of the night should be...',
    options: [
      { id: 'pop', label: 'Pop classic', emoji: '🎵' },
      { id: 'rock', label: 'Rock anthem', emoji: '🤘' },
      { id: 'hiphop', label: 'Hip-hop banger', emoji: '🔥' },
      { id: 'slow-ballad', label: 'Emotional ballad', emoji: '💔' },
    ],
  },
  {
    id: 'party-energy',
    question: "Tonight's energy level is...",
    options: [
      { id: 'chill', label: 'Chill vibes', emoji: '😌' },
      { id: 'medium', label: 'Warming up', emoji: '🙂' },
      { id: 'high', label: 'Let\'s GO', emoji: '🔥' },
      { id: 'max', label: 'ABSOLUTE CHAOS', emoji: '🤯' },
    ],
  },
  {
    id: 'karaoke-courage',
    question: 'Your karaoke courage level?',
    options: [
      { id: 'shy', label: 'Behind the curtain', emoji: '🫣' },
      { id: 'warming', label: 'After one drink', emoji: '🍺' },
      { id: 'ready', label: 'Born ready', emoji: '💪' },
      { id: 'legend', label: 'Living legend', emoji: '👑' },
    ],
  },
  {
    id: 'duet-partner',
    question: 'Ideal duet partner?',
    options: [
      { id: 'bestie', label: 'Best friend', emoji: '👯' },
      { id: 'stranger', label: 'Random stranger', emoji: '🎲' },
      { id: 'crush', label: 'Secret crush', emoji: '😍' },
      { id: 'solo', label: 'Solo forever', emoji: '🎤' },
    ],
  },
  {
    id: 'song-memory',
    question: 'Your song memory superpower?',
    options: [
      { id: 'lyrics', label: 'Know every lyric', emoji: '📝' },
      { id: 'melody', label: 'Hum any melody', emoji: '🎶' },
      { id: 'dance', label: 'Remember the dance', emoji: '💃' },
      { id: 'none', label: 'Forget everything', emoji: '😅' },
    ],
  },
  {
    id: 'stage-presence',
    question: 'Your stage presence is...',
    options: [
      { id: 'statue', label: 'Frozen statue', emoji: '🧊' },
      { id: 'swayer', label: 'Gentle swayer', emoji: '🌊' },
      { id: 'performer', label: 'Full performer', emoji: '🕺' },
      { id: 'chaos', label: 'Crowd surfer', emoji: '🏄' },
    ],
  },
  {
    id: 'guilty-pleasure',
    question: 'Guilty pleasure karaoke song?',
    options: [
      { id: 'boyband', label: 'Boy band hit', emoji: '🎤' },
      { id: 'disney', label: 'Disney classic', emoji: '🏰' },
      { id: 'onemore', label: 'One-hit wonder', emoji: '⭐' },
      { id: 'tiktok', label: 'TikTok trend', emoji: '📱' },
    ],
  },
  {
    id: 'mic-drop',
    question: 'Your mic drop moment?',
    options: [
      { id: 'highnote', label: 'Hit the high note', emoji: '🎵' },
      { id: 'rap', label: 'Nail the rap verse', emoji: '🎤' },
      { id: 'dance', label: 'Epic dance move', emoji: '🕺' },
      { id: 'exit', label: 'Dramatic exit', emoji: '🚪' },
    ],
  },
  {
    id: 'karaoke-fear',
    question: 'Biggest karaoke fear?',
    options: [
      { id: 'lyrics', label: 'Forgetting lyrics', emoji: '😰' },
      { id: 'voice', label: 'Voice crack', emoji: '🫠' },
      { id: 'wrong', label: 'Wrong song starts', emoji: '😱' },
      { id: 'silence', label: 'Awkward silence', emoji: '🦗' },
    ],
  },
];

/**
 * Deal a random question from the pool.
 * No repeat tracking needed — one icebreaker per session.
 */
export function dealQuestion(): IcebreakerQuestion {
  const index = Math.floor(Math.random() * ICEBREAKER_QUESTIONS.length);
  return ICEBREAKER_QUESTIONS[index]!;
}

// --- Vote tally service ---

export interface IcebreakerRound {
  sessionId: string;
  questionId: string;
  optionIds: string[];
  votes: Map<string, string>; // userId → optionId
  resolved: boolean;
}

// Active rounds keyed by sessionId
const activeRounds = new Map<string, IcebreakerRound>();

/**
 * Initialize a new icebreaker round with empty votes.
 */
export function startIcebreakerRound(sessionId: string, questionId: string, optionIds: string[]): void {
  activeRounds.set(sessionId, {
    sessionId,
    questionId,
    optionIds,
    votes: new Map(),
    resolved: false,
  });
}

/**
 * Record a vote. Idempotent — last vote wins.
 * Returns { recorded: false } if no active round or round already resolved.
 * Returns { firstVote: true } only on the user's first vote in this round.
 */
export function recordIcebreakerVote(
  sessionId: string,
  userId: string,
  optionId: string,
): { recorded: boolean; firstVote: boolean } {
  const round = activeRounds.get(sessionId);
  if (!round || round.resolved) return { recorded: false, firstVote: false };

  const firstVote = !round.votes.has(userId);
  round.votes.set(userId, optionId);
  return { recorded: true, firstVote };
}

/**
 * Tally votes, mark round as resolved, return counts with winner.
 * Non-voters are assigned a random option before tallying (AC #3 / UX spec line 2900).
 * Returns null if no active round.
 */
export function resolveIcebreaker(
  sessionId: string,
  participantIds?: string[],
): { optionCounts: Record<string, number>; totalVotes: number; winnerOptionId: string } | null {
  const round = activeRounds.get(sessionId);
  if (!round) return null;

  // Assign random options to non-voters
  if (participantIds && round.optionIds.length > 0) {
    for (const pid of participantIds) {
      if (!round.votes.has(pid)) {
        const randomOption = round.optionIds[Math.floor(Math.random() * round.optionIds.length)]!;
        round.votes.set(pid, randomOption);
      }
    }
  }

  const optionCounts: Record<string, number> = {};
  let totalVotes = 0;

  for (const optionId of round.votes.values()) {
    optionCounts[optionId] = (optionCounts[optionId] ?? 0) + 1;
    totalVotes++;
  }

  // Find winner — highest count, random tiebreaker
  let maxCount = 0;
  const winners: string[] = [];

  for (const [optionId, count] of Object.entries(optionCounts)) {
    if (count > maxCount) {
      maxCount = count;
      winners.length = 0;
      winners.push(optionId);
    } else if (count === maxCount) {
      winners.push(optionId);
    }
  }

  // Fallback to random option ID (not question ID) if no votes at all
  const winnerOptionId = winners.length > 0
    ? winners[Math.floor(Math.random() * winners.length)]!
    : round.optionIds[Math.floor(Math.random() * round.optionIds.length)] ?? round.optionIds[0] ?? '';

  round.resolved = true;

  return { optionCounts, totalVotes, winnerOptionId };
}

/**
 * Clear icebreaker round for a session.
 */
export function clearSession(sessionId: string): void {
  activeRounds.delete(sessionId);
}

/**
 * Test utility — clear all session data.
 */
export function resetAll(): void {
  activeRounds.clear();
}
