import type { DJState } from '../dj-engine/types.js';
import type { AwardTone } from '../services/award-generator.js';

export type SessionEvent =
  | { type: 'dj:stateChanged'; ts: number; userId?: string; data: { from: DJState; to: DJState; trigger: string } }
  | { type: 'dj:pause'; ts: number; userId?: string; data: { fromState: DJState } }
  | { type: 'dj:resume'; ts: number; userId?: string; data: { toState: DJState } }
  | { type: 'party:started'; ts: number; userId: string; data: { participantCount: number } }
  | { type: 'party:ended'; ts: number; userId: string; data: { songCount: number; duration: number } }
  | { type: 'party:joined'; ts: number; userId: string; data: { displayName: string; role: 'guest' | 'authenticated' } }
  | { type: 'party:left'; ts: number; userId: string; data: { displayName: string } }
  | { type: 'party:kicked'; ts: number; userId: string; data: { kickedUserId: string } }
  | { type: 'party:hostTransferred'; ts: number; userId?: string; data: { fromUserId: string; toUserId: string } }
  | { type: 'party:vibeChanged'; ts: number; userId: string; data: { vibe: string } }
  | { type: 'host:skip'; ts: number; userId: string; data: { fromState: DJState } }
  | { type: 'host:override'; ts: number; userId: string; data: { fromState: DJState; toState: DJState } }
  | { type: 'host:songOver'; ts: number; userId: string; data: { fromState: DJState } }
  | { type: 'ceremony:typeSelected'; ts: number; data: { ceremonyType: 'full' | 'quick'; songCount: number; participantCount: number } }
  | { type: 'participation:scored'; ts: number; userId: string; data: { action: string; tier: string; points: number; rewardMultiplier: number; totalScore: number } }
  | { type: 'ceremony:awardGenerated'; ts: number; userId: string; data: { award: string; songPosition: number; ceremonyType: 'full' | 'quick'; tone: AwardTone; contextFactors: { cardCompleted: boolean; reactionCount: number; participationScore: number } } }
  | { type: 'ceremony:revealed'; ts: number; data: { award: string; performerName: string | null; ceremonyType: 'full' | 'quick'; songTitle: string | null } }
  | { type: 'reaction:sent'; ts: number; userId: string; data: { emoji: string; streak: number } }
  | { type: 'sound:play'; ts: number; userId: string; data: { soundId: string } }
  | { type: 'card:dealt'; ts: number; data: { cardId: string; cardType: string } }
  | { type: 'card:sessionStats'; ts: number; data: { dealt: number; accepted: number } }
  | { type: 'card:accepted'; ts: number; userId: string; data: { cardId: string; cardType: string } }
  | { type: 'card:dismissed'; ts: number; userId: string; data: { cardId: string; cardType: string } }
  | { type: 'card:redealt'; ts: number; userId: string; data: { previousCardId: string; newCardId: string } }
  | { type: 'card:groupActivated'; ts: number; userId: string; data: { cardId: string; selectedUserIds: string[]; announcement: string } }
  | { type: 'lightstick:toggled'; ts: number; userId: string; data: { active: boolean } }
  | { type: 'hype:fired'; ts: number; userId: string; data: Record<string, never> }
  | { type: 'quickpick:vote'; ts: number; userId: string; data: { catalogTrackId: string; vote: 'up' | 'skip' } }
  | { type: 'quickpick:selected'; ts: number; data: { song: { catalogTrackId: string; songTitle: string; artist: string; youtubeVideoId: string; overlapCount: number } } }
  | { type: 'spinwheel:spin'; ts: number; userId: string }
  | { type: 'spinwheel:veto'; ts: number; userId: string; data: { vetoedSong: string } }
  | { type: 'spinwheel:selected'; ts: number; data: { song: { catalogTrackId: string; songTitle: string; artist: string; youtubeVideoId: string; overlapCount: number; segmentIndex: number } } }
  | { type: 'song:modeChanged'; ts: number; userId: string; data: { mode: 'quickPick' | 'spinWheel' } }
  | { type: 'system:recovery'; ts: number; data: { recoveredState: DJState; songCount: number } };

const streams = new Map<string, SessionEvent[]>();

export function appendEvent(sessionId: string, event: SessionEvent): void {
  let stream = streams.get(sessionId);
  if (!stream) {
    stream = [];
    streams.set(sessionId, stream);
  }
  stream.push(event);
}

export function getEventStream(sessionId: string): SessionEvent[] {
  const stream = streams.get(sessionId);
  return stream ? [...stream] : [];
}

export function flushEventStream(sessionId: string): SessionEvent[] {
  const stream = streams.get(sessionId);
  if (!stream) return [];
  streams.delete(sessionId);
  return stream;
}

export function removeEventStream(sessionId: string): void {
  streams.delete(sessionId);
}

export function clearAllStreams(): void {
  streams.clear();
}
