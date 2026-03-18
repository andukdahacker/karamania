// Quick Vote question pool, dealer, and vote tally — binary opinion polls for interlude games
// Same module-level Map pattern as kings-cup-dealer.ts, dare-pull-dealer.ts

export interface QuickVoteQuestion {
  id: string;
  question: string;
  optionA: string;
  optionB: string;
  emoji: string;
}

export const QUICK_VOTE_QUESTIONS: readonly QuickVoteQuestion[] = [
  { id: 'bohemian-rhapsody', question: 'Is Bohemian Rhapsody overrated?', optionA: 'YES', optionB: 'NO', emoji: '🎸' },
  { id: 'pineapple-pizza', question: 'Pineapple on pizza?', optionA: 'ALWAYS', optionB: 'NEVER', emoji: '🍕' },
  { id: 'morning-night', question: 'Morning person or night owl?', optionA: 'MORNING', optionB: 'NIGHT', emoji: '🌙' },
  { id: 'dogs-cats', question: 'Dogs or cats?', optionA: 'DOGS', optionB: 'CATS', emoji: '🐾' },
  { id: 'toilet-paper', question: 'Toilet paper: over or under?', optionA: 'OVER', optionB: 'UNDER', emoji: '🧻' },
  { id: 'horse-duck', question: 'Fight 1 horse-sized duck or 100 duck-sized horses?', optionA: '1 BIG', optionB: '100 SMALL', emoji: '🦆' },
  { id: 'cereal-soup', question: 'Is cereal a soup?', optionA: 'YES', optionB: 'NO', emoji: '🥣' },
  { id: 'socks-sandals', question: 'Socks with sandals?', optionA: 'FASHION', optionB: 'CRIME', emoji: '🩴' },
  { id: 'ketchup-hotdog', question: 'Ketchup on a hot dog?', optionA: 'OBVIOUSLY', optionB: 'NEVER', emoji: '🌭' },
  { id: 'hotdog-sandwich', question: 'Is a hot dog a sandwich?', optionA: 'YES', optionB: 'NO', emoji: '🥪' },
  { id: 'shower-morning', question: 'Shower in the morning or at night?', optionA: 'MORNING', optionB: 'NIGHT', emoji: '🚿' },
  { id: 'fold-scrunch', question: 'Fold or scrunch?', optionA: 'FOLD', optionB: 'SCRUNCH', emoji: '📄' },
  { id: 'sweet-savory', question: 'Sweet or savory breakfast?', optionA: 'SWEET', optionB: 'SAVORY', emoji: '🥞' },
  { id: 'movie-book', question: 'Movies or books?', optionA: 'MOVIES', optionB: 'BOOKS', emoji: '🎬' },
  { id: 'beach-mountain', question: 'Beach vacation or mountain retreat?', optionA: 'BEACH', optionB: 'MOUNTAIN', emoji: '🏖️' },
  { id: 'fly-invisible', question: 'Would you rather fly or be invisible?', optionA: 'FLY', optionB: 'INVISIBLE', emoji: '✈️' },
  { id: 'time-travel', question: 'Travel to the past or the future?', optionA: 'PAST', optionB: 'FUTURE', emoji: '⏰' },
  { id: 'gif-pronunciation', question: 'Is it GIF or JIF?', optionA: 'GIF', optionB: 'JIF', emoji: '🖼️' },
  { id: 'die-hard', question: 'Is Die Hard a Christmas movie?', optionA: 'YES', optionB: 'NO', emoji: '🎄' },
  { id: 'water-wet', question: 'Is water wet?', optionA: 'YES', optionB: 'NO', emoji: '💧' },
  { id: 'alien-exist', question: 'Do aliens exist?', optionA: 'YES', optionB: 'NO', emoji: '👽' },
  { id: 'cake-pie', question: 'Cake or pie?', optionA: 'CAKE', optionB: 'PIE', emoji: '🎂' },
  { id: 'summer-winter', question: 'Summer or winter?', optionA: 'SUMMER', optionB: 'WINTER', emoji: '☀️' },
  { id: 'text-call', question: 'Text or call?', optionA: 'TEXT', optionB: 'CALL', emoji: '📱' },
] as const;

// Track last dealt question per session to avoid immediate repeats
const lastDealtQuestion = new Map<string, string>();

/**
 * Deal a random question from the pool, avoiding immediate repeats per session.
 */
export function dealQuestion(sessionId: string): QuickVoteQuestion {
  const lastId = lastDealtQuestion.get(sessionId);
  let eligible = QUICK_VOTE_QUESTIONS.filter(q => q.id !== lastId);

  // Fallback: if filtering leaves nothing (shouldn't happen with 24 questions), use full pool
  if (eligible.length === 0) {
    eligible = [...QUICK_VOTE_QUESTIONS];
  }

  const index = Math.floor(Math.random() * eligible.length);
  const question = eligible[index]!;
  lastDealtQuestion.set(sessionId, question.id);
  return question;
}

// --- Vote tally service ---

export interface QuickVoteRound {
  sessionId: string;
  questionId: string;
  votes: Map<string, 'A' | 'B'>;
  resolved: boolean;
}

// Active rounds keyed by sessionId
const activeRounds = new Map<string, QuickVoteRound>();

/**
 * Initialize a new Quick Vote round with empty votes.
 */
export function startQuickVoteRound(sessionId: string, questionId: string): void {
  activeRounds.set(sessionId, {
    sessionId,
    questionId,
    votes: new Map(),
    resolved: false,
  });
}

/**
 * Record a vote. Idempotent — last vote wins.
 * Returns { recorded: false } if no active round or round already resolved.
 * Returns { firstVote: true } only on the user's first vote in this round.
 */
export function recordQuickVote(
  sessionId: string,
  userId: string,
  option: 'A' | 'B',
): { recorded: boolean; firstVote: boolean } {
  const round = activeRounds.get(sessionId);
  if (!round || round.resolved) return { recorded: false, firstVote: false };

  const firstVote = !round.votes.has(userId);
  round.votes.set(userId, option);
  return { recorded: true, firstVote };
}

/**
 * Tally votes, mark round as resolved, return counts.
 * Returns null if no active round.
 */
export function resolveQuickVote(
  sessionId: string,
): { optionACounts: number; optionBCounts: number; totalVotes: number } | null {
  const round = activeRounds.get(sessionId);
  if (!round) return null;

  let optionACounts = 0;
  let optionBCounts = 0;

  for (const vote of round.votes.values()) {
    if (vote === 'A') optionACounts++;
    else optionBCounts++;
  }

  round.resolved = true;

  return {
    optionACounts,
    optionBCounts,
    totalVotes: optionACounts + optionBCounts,
  };
}

/**
 * Clear last-dealt question tracking and active round for a session.
 */
export function clearSession(sessionId: string): void {
  lastDealtQuestion.delete(sessionId);
  activeRounds.delete(sessionId);
}

/**
 * Test utility — clear all session data.
 */
export function resetAll(): void {
  lastDealtQuestion.clear();
  activeRounds.clear();
}
