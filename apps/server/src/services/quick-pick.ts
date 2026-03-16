// In-memory Quick Pick vote tracker — tracks votes per song per user per session
// Same module-level Map pattern as dj-state-store.ts, song-pool.ts, connection-tracker.ts

export interface VoteTally {
  up: number;
  skip: number;
}

export interface QuickPickSong {
  catalogTrackId: string;
  songTitle: string;
  artist: string;
  youtubeVideoId: string;
  overlapCount: number;
}

export interface QuickPickRound {
  sessionId: string;
  songs: QuickPickSong[];
  votes: Map<string, Map<string, 'up' | 'skip'>>; // catalogTrackId -> userId -> vote
  participantCount: number;
  startedAt: number;
  resolved: boolean;
  winningSongId: string | null;
}

const rounds = new Map<string, QuickPickRound>();

export function startRound(
  sessionId: string,
  songs: QuickPickSong[],
  participantCount: number,
): QuickPickRound {
  const votes = new Map<string, Map<string, 'up' | 'skip'>>();
  for (const song of songs) {
    votes.set(song.catalogTrackId, new Map());
  }

  const round: QuickPickRound = {
    sessionId,
    songs,
    votes,
    participantCount,
    startedAt: Date.now(),
    resolved: false,
    winningSongId: null,
  };

  rounds.set(sessionId, round);
  return round;
}

/**
 * Core voting algorithm — pure synchronous function.
 * Node.js single-threaded event loop guarantees no race conditions (NFR11).
 * Idempotent per user per song — last vote wins if user changes mind.
 */
export function recordVote(
  sessionId: string,
  userId: string,
  catalogTrackId: string,
  vote: 'up' | 'skip',
): { recorded: boolean; songVotes: VoteTally; winner: QuickPickSong | null } {
  const round = rounds.get(sessionId);
  if (!round || round.resolved) {
    return { recorded: false, songVotes: { up: 0, skip: 0 }, winner: null };
  }

  const songVoteMap = round.votes.get(catalogTrackId);
  if (!songVoteMap) {
    return { recorded: false, songVotes: { up: 0, skip: 0 }, winner: null };
  }

  // Record vote (idempotent — overwrites previous vote for this user on this song)
  songVoteMap.set(userId, vote);

  // Compute current tally for this song
  const songVotes = computeTally(songVoteMap);

  // Check for majority winner after every vote
  const winner = checkMajority(round);

  return { recorded: true, songVotes, winner };
}

function computeTally(voteMap: Map<string, 'up' | 'skip'>): VoteTally {
  let up = 0;
  let skip = 0;
  for (const vote of voteMap.values()) {
    if (vote === 'up') up++;
    else skip++;
  }
  return { up, skip };
}

/**
 * Check if any song has majority approval (> floor(participantCount / 2) up-votes).
 * Tiebreaker: most up-votes, then first in array order.
 */
export function checkMajority(round: QuickPickRound): QuickPickSong | null {
  const threshold = Math.floor(round.participantCount / 2) + 1;
  let bestSong: QuickPickSong | null = null;
  let bestUpVotes = 0;

  for (const song of round.songs) {
    const voteMap = round.votes.get(song.catalogTrackId);
    if (!voteMap) continue;

    let upVotes = 0;
    for (const vote of voteMap.values()) {
      if (vote === 'up') upVotes++;
    }

    if (upVotes >= threshold && upVotes > bestUpVotes) {
      bestSong = song;
      bestUpVotes = upVotes;
    }
  }

  if (bestSong) {
    round.resolved = true;
    round.winningSongId = bestSong.catalogTrackId;
  }

  return bestSong;
}

/**
 * Resolve by timeout — pick highest-voted song.
 * Tiebreaker: higher overlapCount, then first in array order.
 * If zero votes, returns first song.
 */
export function resolveByTimeout(sessionId: string): QuickPickSong | null {
  const round = rounds.get(sessionId);
  if (!round || round.resolved) return null;

  let bestSong: QuickPickSong | null = null;
  let bestUpVotes = -1;
  let bestOverlap = -1;

  for (const song of round.songs) {
    const voteMap = round.votes.get(song.catalogTrackId);
    let upVotes = 0;
    if (voteMap) {
      for (const vote of voteMap.values()) {
        if (vote === 'up') upVotes++;
      }
    }

    if (
      upVotes > bestUpVotes ||
      (upVotes === bestUpVotes && song.overlapCount > bestOverlap)
    ) {
      bestSong = song;
      bestUpVotes = upVotes;
      bestOverlap = song.overlapCount;
    }
  }

  round.resolved = true;
  if (bestSong) {
    round.winningSongId = bestSong.catalogTrackId;
  }

  return bestSong ?? null;
}

export function getRound(sessionId: string): QuickPickRound | undefined {
  return rounds.get(sessionId);
}

export function clearRound(sessionId: string): void {
  rounds.delete(sessionId);
}

export function resetAllRounds(): void {
  rounds.clear();
}
