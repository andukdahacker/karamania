// In-memory activity vote tracker — tracks votes per session for interlude activities
// Same module-level Map pattern as quick-pick.ts, peak-detector.ts

export interface ActivityOption {
  id: string;
  name: string;
  description: string;
  icon: string;
  universal: boolean;
  minParticipants: number;
}

export interface ActivityVoteRound {
  sessionId: string;
  options: ActivityOption[];
  votes: Map<string, string>; // userId -> optionId (simpler than quick-pick: single choice)
  participantCount: number;
  startedAt: number;
  resolved: boolean;
  winningOptionId: string | null;
  interludeCount: number;
}

const ACTIVITY_POOL: ActivityOption[] = [
  { id: 'kings_cup', name: 'Kings Cup', description: 'Draw cards, follow the rules!', icon: '👑', universal: true, minParticipants: 3 },
  { id: 'dare_pull', name: 'Dare Pull', description: 'Pull a dare, make it happen!', icon: '🎯', universal: false, minParticipants: 3 },
  { id: 'quick_vote', name: 'Quick Vote', description: 'Fast group polls and hot takes!', icon: '⚡', universal: true, minParticipants: 2 },
  { id: 'group_singalong', name: 'Group Sing-Along', description: 'Everyone sings together!', icon: '🎤', universal: true, minParticipants: 2 },
];

const rounds = new Map<string, ActivityVoteRound>();
const lastSelectedActivity = new Map<string, string>(); // sessionId -> last winning activity id

/**
 * Select 2-3 activity options for voting based on session context.
 * Applies participant filtering, front-loading (universal first 30 min), and no-repeat rules.
 */
export function selectActivityOptions(
  sessionId: string,
  participantCount: number,
  sessionStartedAt: number,
  _interludeCount: number = 0, // Reserved for Story 7.6 icebreaker logic
): ActivityOption[] {
  const now = Date.now();
  const sessionAgeMs = now - sessionStartedAt;
  const isEarlySession = sessionAgeMs < 30 * 60 * 1000; // first 30 minutes

  // 1. Filter by minParticipants
  let eligible = ACTIVITY_POOL.filter(a => participantCount >= a.minParticipants);

  // 2. If session < 30 min: filter to universal only (exclude dare_pull)
  if (isEarlySession) {
    eligible = eligible.filter(a => a.universal);
  }

  // 3. Exclude last selected activity (no immediate repeat)
  const lastSelected = lastSelectedActivity.get(sessionId);
  if (lastSelected && eligible.length > 1) {
    eligible = eligible.filter(a => a.id !== lastSelected);
  }

  // 4. Weighted random selection — pick 2-3 options
  const targetCount = Math.min(eligible.length, eligible.length >= 3 ? 3 : 2);
  const selected: ActivityOption[] = [];
  const remaining = [...eligible];

  for (let i = 0; i < targetCount && remaining.length > 0; i++) {
    const index = Math.floor(Math.random() * remaining.length);
    selected.push(remaining[index]!);
    remaining.splice(index, 1);
  }

  return selected;
}

/**
 * Start a vote round with given options.
 */
export function startVoteRound(
  sessionId: string,
  options: ActivityOption[],
  participantCount: number,
  interludeCount: number = 0,
): ActivityVoteRound {
  const round: ActivityVoteRound = {
    sessionId,
    options,
    votes: new Map(),
    participantCount,
    startedAt: Date.now(),
    resolved: false,
    winningOptionId: null,
    interludeCount,
  };

  rounds.set(sessionId, round);
  return round;
}

/**
 * Record a vote — idempotent (last vote wins).
 * Node.js single-threaded event loop guarantees no race conditions (NFR11).
 */
export function recordVote(
  sessionId: string,
  userId: string,
  optionId: string,
): { recorded: boolean; voteCounts: Record<string, number>; winner: ActivityOption | null } {
  const round = rounds.get(sessionId);
  if (!round || round.resolved) {
    return { recorded: false, voteCounts: {}, winner: null };
  }

  // Validate optionId is one of the round's options
  const validOption = round.options.find(o => o.id === optionId);
  if (!validOption) {
    return { recorded: false, voteCounts: {}, winner: null };
  }

  // Record vote (idempotent — overwrites previous vote for this user)
  round.votes.set(userId, optionId);

  // Compute current tallies
  const voteCounts = computeVoteCounts(round);

  // Check for majority winner
  const winner = checkMajority(round);

  return { recorded: true, voteCounts, winner };
}

function computeVoteCounts(round: ActivityVoteRound): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const option of round.options) {
    counts[option.id] = 0;
  }
  for (const optionId of round.votes.values()) {
    if (counts[optionId] !== undefined) {
      counts[optionId]++;
    }
  }
  return counts;
}

/**
 * Check if any option has majority votes (> floor(participantCount / 2)).
 */
export function checkMajority(round: ActivityVoteRound): ActivityOption | null {
  const threshold = Math.floor(round.participantCount / 2) + 1;
  const counts = computeVoteCounts(round);

  let bestOption: ActivityOption | null = null;
  let bestVotes = 0;

  for (const option of round.options) {
    const votes = counts[option.id] ?? 0;
    if (votes >= threshold && votes > bestVotes) {
      bestOption = option;
      bestVotes = votes;
    }
  }

  if (bestOption) {
    round.resolved = true;
    round.winningOptionId = bestOption.id;
    lastSelectedActivity.set(round.sessionId, bestOption.id);
  }

  return bestOption;
}

/**
 * Resolve by timeout — pick highest-voted option, random tiebreaker.
 * When zero votes are cast, picks a random option (intentional: ensures interlude always produces a result).
 */
export function resolveByTimeout(sessionId: string): ActivityOption | null {
  const round = rounds.get(sessionId);
  if (!round || round.resolved) return null;

  const counts = computeVoteCounts(round);

  // Find max vote count (0 when no votes — all options tied, random pick)
  let maxVotes = 0;
  for (const option of round.options) {
    const votes = counts[option.id] ?? 0;
    if (votes > maxVotes) {
      maxVotes = votes;
    }
  }

  // Collect all options with max votes (for random tiebreaker)
  const tied = round.options.filter(o => (counts[o.id] ?? 0) === maxVotes);

  // Random tiebreaker
  const winner = tied[Math.floor(Math.random() * tied.length)]!;

  round.resolved = true;
  round.winningOptionId = winner.id;
  lastSelectedActivity.set(sessionId, winner.id);

  return winner;
}

export function getRound(sessionId: string): ActivityVoteRound | undefined {
  return rounds.get(sessionId);
}

export function getVoteCounts(sessionId: string): Record<string, number> {
  const round = rounds.get(sessionId);
  if (!round) return {};
  return computeVoteCounts(round);
}

export function clearSession(sessionId: string): void {
  rounds.delete(sessionId);
  lastSelectedActivity.delete(sessionId);
}

export function resetAllRounds(): void {
  rounds.clear();
  lastSelectedActivity.clear();
}

// Exported for testing
export { ACTIVITY_POOL };
