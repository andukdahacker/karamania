// Dare Pull dare pool and dealer — individual spotlight dares for interlude games
// Same module-level Map pattern as kings-cup-dealer.ts

import type { TrackedConnection } from './connection-tracker.js';

export interface DarePullDare {
  id: string;
  title: string;
  dare: string;
  emoji: string;
}

export const DARE_PULL_DARES: readonly DarePullDare[] = [
  { id: 'air-guitar', title: 'Air Guitar Solo!', dare: 'Shred an imaginary guitar for 10 seconds', emoji: '🎸' },
  { id: 'celebrity-impression', title: 'Celebrity Impression', dare: 'Do your best impression of any celebrity', emoji: '🎭' },
  { id: 'dance-move', title: 'Signature Move', dare: 'Show off your signature dance move', emoji: '💃' },
  { id: 'opera-singer', title: 'Opera Singer', dare: 'Sing the last lyric you remember in an opera voice', emoji: '🎶' },
  { id: 'robot-mode', title: 'Robot Mode', dare: 'Move like a robot until the timer ends', emoji: '🤖' },
  { id: 'acceptance-speech', title: 'Acceptance Speech', dare: 'Give a dramatic award acceptance speech', emoji: '🏆' },
  { id: 'whisper-song', title: 'Whisper Song', dare: 'Whisper-sing any song and everyone guesses', emoji: '🤫' },
  { id: 'slow-motion', title: 'Slow Motion', dare: 'Do everything in slow motion until the timer ends', emoji: '🐌' },
  { id: 'news-anchor', title: 'Breaking News', dare: 'Report what just happened at the party as a news anchor', emoji: '📺' },
  { id: 'beatbox', title: 'Beatbox Drop', dare: 'Drop your best beatbox for 10 seconds', emoji: '🥁' },
  { id: 'movie-trailer', title: 'Movie Trailer Voice', dare: 'Narrate the party in a dramatic movie trailer voice', emoji: '🎬' },
  { id: 'invisible-wall', title: 'Invisible Wall', dare: 'Pretend you are trapped behind an invisible wall', emoji: '🧱' },
  { id: 'superhero-pose', title: 'Superhero Pose', dare: 'Strike your most powerful superhero pose and hold it', emoji: '🦸' },
  { id: 'tongue-twister', title: 'Tongue Twister', dare: 'Say "she sells seashells by the seashore" three times fast', emoji: '👅' },
  { id: 'dramatic-exit', title: 'Dramatic Exit', dare: 'Pretend to leave the room dramatically, then come back', emoji: '🚪' },
  { id: 'animal-walk', title: 'Animal Walk', dare: 'Walk like your favorite animal across the room', emoji: '🐒' },
  { id: 'air-drums', title: 'Air Drums', dare: 'Play an imaginary drum solo with full energy', emoji: '🪘' },
  { id: 'compliment-rap', title: 'Compliment Rap', dare: 'Rap a compliment about the person nearest to you', emoji: '🎤' },
  { id: 'freeze-frame', title: 'Freeze Frame', dare: 'Strike a pose and hold completely still until the timer ends', emoji: '🧊' },
  { id: 'evil-laugh', title: 'Evil Laugh', dare: 'Do your most dramatic villain laugh', emoji: '😈' },
] as const;

// Track last dealt dare per session to avoid immediate repeats
const lastDealtDare = new Map<string, string>();

// Track last targeted user per session to avoid immediate repeats
const lastTargetUserId = new Map<string, string>();

/**
 * Deal a random dare from the pool, avoiding immediate repeats per session.
 */
export function dealDare(sessionId: string): DarePullDare {
  const lastId = lastDealtDare.get(sessionId);
  let eligible = DARE_PULL_DARES.filter(d => d.id !== lastId);

  // Fallback: if filtering leaves nothing (shouldn't happen with 18 dares), use full pool
  if (eligible.length === 0) {
    eligible = [...DARE_PULL_DARES];
  }

  const index = Math.floor(Math.random() * eligible.length);
  const dare = eligible[index]!;
  lastDealtDare.set(sessionId, dare.id);
  return dare;
}

/**
 * Select a random target from active connections, avoiding immediate repeats per session.
 */
export function selectTarget(sessionId: string, connections: TrackedConnection[]): TrackedConnection | null {
  if (connections.length === 0) return null;

  const lastUserId = lastTargetUserId.get(sessionId);
  let eligible = connections.length > 1
    ? connections.filter(c => c.userId !== lastUserId)
    : connections;

  // Fallback: if filtering leaves nothing, use full list
  if (eligible.length === 0) {
    eligible = [...connections];
  }

  // Fisher-Yates shuffle
  const shuffled = [...eligible];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j]!, shuffled[i]!];
  }

  const target = shuffled[0]!;
  lastTargetUserId.set(sessionId, target.userId);
  return target;
}

/**
 * Clear last-dealt and last-target tracking for a session.
 */
export function clearSession(sessionId: string): void {
  lastDealtDare.delete(sessionId);
  lastTargetUserId.delete(sessionId);
}

/**
 * Test utility — clear all session data.
 */
export function resetAll(): void {
  lastDealtDare.clear();
  lastTargetUserId.clear();
}
