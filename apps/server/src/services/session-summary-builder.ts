import type { FinaleAwardCategory } from './finale-award-generator.js';
import type { AwardTone } from './award-generator.js';
import type { SessionStats, SetlistEntry, SessionSummary } from '../shared/schemas/finale-schemas.js';

export type { SessionSummary };

export interface BuildSummaryInput {
  sessionId: string;
  stats: SessionStats;
  setlist: SetlistEntry[];
  awards: Array<{
    userId: string;
    displayName: string;
    category: FinaleAwardCategory;
    title: string;
    tone: AwardTone;
    reason: string;
  }>;
  participants: Array<{
    userId: string | null;
    displayName: string;
    participationScore: number;
    topAward: string | null;
  }>;
}

export function buildSessionSummary(input: BuildSummaryInput): SessionSummary {
  return {
    version: 1,
    generatedAt: Date.now(),
    stats: {
      songCount: input.stats.songCount,
      participantCount: input.stats.participantCount,
      sessionDurationMs: input.stats.sessionDurationMs,
      totalReactions: input.stats.totalReactions,
      totalSoundboardPlays: input.stats.totalSoundboardPlays,
      totalCardsDealt: input.stats.totalCardsDealt,
      topReactor: input.stats.topReactor,
      longestStreak: input.stats.longestStreak,
    },
    setlist: input.setlist.map(s => ({
      position: s.position,
      title: s.title,
      artist: s.artist,
      performerName: s.performerName,
      awardTitle: s.awardTitle,
      awardTone: s.awardTone,
    })),
    awards: input.awards.map(a => ({
      userId: a.userId,
      displayName: a.displayName,
      category: a.category,
      title: a.title,
      tone: a.tone,
      reason: a.reason,
    })),
    participants: input.participants.map(p => ({
      userId: p.userId,
      displayName: p.displayName,
      participationScore: p.participationScore,
      topAward: p.topAward,
    })),
  };
}
