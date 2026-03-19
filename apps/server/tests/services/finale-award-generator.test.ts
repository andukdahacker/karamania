import { describe, it, expect } from 'vitest';
import {
  FINALE_AWARD_TEMPLATES,
  FinaleAwardCategory,
  analyzeSessionForAwards,
  generateFinaleAwards,
  type SessionAnalysis,
} from '../../src/services/finale-award-generator.js';
import { AwardTone } from '../../src/services/award-generator.js';
import type { SessionEvent } from '../../src/services/event-stream.js';

// --- Helper factories ---

function createParticipant(overrides: Partial<{ userId: string; displayName: string; participationScore: number }> = {}) {
  return {
    userId: overrides.userId ?? 'user-1',
    displayName: overrides.displayName ?? 'Player 1',
    participationScore: overrides.participationScore ?? 10,
  };
}

function createAnalysis(overrides: Partial<SessionAnalysis> = {}): SessionAnalysis {
  return {
    userId: 'user-1',
    displayName: 'Player 1',
    participationScore: 10,
    reactionsSent: 0,
    reactionsReceived: 0,
    songsPerformed: 0,
    cardsAccepted: 0,
    cardsCompleted: 0,
    streakMax: 0,
    soundboardUses: 0,
    votesParticipated: 0,
    distinctActionCategories: 0,
    perSongAwards: [],
    ...overrides,
  };
}

// --- Template Pool Tests ---

describe('Finale Award Templates', () => {
  it('has at least 35 templates', () => {
    expect(FINALE_AWARD_TEMPLATES.length).toBeGreaterThanOrEqual(35);
  });

  it('covers all 7 categories', () => {
    const categories = new Set(FINALE_AWARD_TEMPLATES.map(t => t.category));
    expect(categories.size).toBe(7);
    for (const cat of Object.values(FinaleAwardCategory)) {
      expect(categories.has(cat)).toBe(true);
    }
  });

  it('meets minimum per-category counts', () => {
    const counts: Record<string, number> = {};
    for (const t of FINALE_AWARD_TEMPLATES) {
      counts[t.category] = (counts[t.category] ?? 0) + 1;
    }
    expect(counts['performer']).toBeGreaterThanOrEqual(6);
    expect(counts['hypeLeader']).toBeGreaterThanOrEqual(5);
    expect(counts['socialButterfly']).toBeGreaterThanOrEqual(4);
    expect(counts['crowdFavorite']).toBeGreaterThanOrEqual(4);
    expect(counts['partyStarter']).toBeGreaterThanOrEqual(4);
    expect(counts['vibeKeeper']).toBeGreaterThanOrEqual(4);
    expect(counts['everyone']).toBeGreaterThanOrEqual(8);
  });

  it('has all tones present', () => {
    const tones = new Set(FINALE_AWARD_TEMPLATES.map(t => t.tone));
    for (const tone of Object.values(AwardTone)) {
      expect(tones.has(tone)).toBe(true);
    }
  });

  it('has no duplicate titles', () => {
    const titles = FINALE_AWARD_TEMPLATES.map(t => t.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('everyone templates are character-trait only (no performance references)', () => {
    const everyoneTemplates = FINALE_AWARD_TEMPLATES.filter(t => t.category === FinaleAwardCategory.everyone);
    const performancePatterns = [/\bsing\b/i, /\bsang\b/i, /\bsong\b/i, /\bperform/i, /\bvocal/i, /\bkaraoke\b/i, /\bvoice\b/i];
    for (const t of everyoneTemplates) {
      for (const pattern of performancePatterns) {
        expect(t.title).not.toMatch(pattern);
      }
    }
  });
});

// --- Session Analysis Tests ---

describe('analyzeSessionForAwards', () => {
  it('aggregates reaction counts per user from event stream', () => {
    const events: SessionEvent[] = [
      { type: 'reaction:sent', ts: 1, userId: 'u1', data: { emoji: '🎉', streak: 1 } },
      { type: 'reaction:sent', ts: 2, userId: 'u1', data: { emoji: '🎉', streak: 2 } },
      { type: 'reaction:sent', ts: 3, userId: 'u2', data: { emoji: '🔥', streak: 1 } },
    ];
    const participants = [
      createParticipant({ userId: 'u1', displayName: 'A' }),
      createParticipant({ userId: 'u2', displayName: 'B' }),
    ];

    const result = analyzeSessionForAwards(events, participants, new Map());
    const u1 = result.find(r => r.userId === 'u1')!;
    const u2 = result.find(r => r.userId === 'u2')!;

    expect(u1.reactionsSent).toBe(2);
    expect(u1.streakMax).toBe(2);
    expect(u2.reactionsSent).toBe(1);
  });

  it('counts card:accepted events per user', () => {
    const events: SessionEvent[] = [
      { type: 'card:accepted', ts: 1, userId: 'u1', data: { cardId: 'c1', cardType: 'vocal' } },
      { type: 'card:accepted', ts: 2, userId: 'u1', data: { cardId: 'c2', cardType: 'performance' } },
      { type: 'card:dismissed', ts: 3, userId: 'u2', data: { cardId: 'c3', cardType: 'group' } },
    ];
    const participants = [
      createParticipant({ userId: 'u1' }),
      createParticipant({ userId: 'u2' }),
    ];

    const result = analyzeSessionForAwards(events, participants, new Map());
    expect(result.find(r => r.userId === 'u1')!.cardsAccepted).toBe(2);
    expect(result.find(r => r.userId === 'u2')!.cardsAccepted).toBe(0);
  });

  it('handles empty event stream', () => {
    const result = analyzeSessionForAwards([], [createParticipant()], new Map());
    expect(result).toHaveLength(1);
    expect(result[0]!.reactionsSent).toBe(0);
    expect(result[0]!.songsPerformed).toBe(0);
  });

  it('handles participants with no events', () => {
    const events: SessionEvent[] = [
      { type: 'reaction:sent', ts: 1, userId: 'u1', data: { emoji: '🎉', streak: 1 } },
    ];
    const participants = [
      createParticipant({ userId: 'u1' }),
      createParticipant({ userId: 'u2', displayName: 'Ghost' }),
    ];

    const result = analyzeSessionForAwards(events, participants, new Map());
    const ghost = result.find(r => r.userId === 'u2')!;
    expect(ghost.reactionsSent).toBe(0);
    expect(ghost.distinctActionCategories).toBe(0);
  });

  it('counts distinct action categories for vibeKeeper', () => {
    const events: SessionEvent[] = [
      { type: 'reaction:sent', ts: 1, userId: 'u1', data: { emoji: '🎉', streak: 1 } },
      { type: 'sound:play', ts: 2, userId: 'u1', data: { soundId: 's1' } },
      { type: 'card:accepted', ts: 3, userId: 'u1', data: { cardId: 'c1', cardType: 'vocal' } },
      { type: 'interlude:vote', ts: 4, userId: 'u1', data: { optionId: 'o1' } },
    ];
    const result = analyzeSessionForAwards(events, [createParticipant({ userId: 'u1' })], new Map());
    expect(result[0]!.distinctActionCategories).toBe(4);
  });

  it('tracks songs performed from ceremony:awardGenerated events', () => {
    const events: SessionEvent[] = [
      { type: 'ceremony:awardGenerated', ts: 1, userId: 'u1', data: { award: 'Star', songPosition: 1, ceremonyType: 'full', tone: AwardTone.hype, contextFactors: { cardCompleted: false, reactionCount: 5, participationScore: 10 } } },
      { type: 'ceremony:awardGenerated', ts: 2, userId: 'u1', data: { award: 'Fire', songPosition: 2, ceremonyType: 'quick', tone: AwardTone.comedic, contextFactors: { cardCompleted: false, reactionCount: 3, participationScore: 15 } } },
    ];
    const result = analyzeSessionForAwards(events, [createParticipant({ userId: 'u1' })], new Map());
    expect(result[0]!.songsPerformed).toBe(2);
    expect(result[0]!.reactionsReceived).toBe(8);
  });
});

// --- Award Generation Tests ---

describe('generateFinaleAwards', () => {
  const seededRandom = () => 0.5;

  it('gives every participant at least 1 award', () => {
    const analyses = [
      createAnalysis({ userId: 'u1', displayName: 'A' }),
      createAnalysis({ userId: 'u2', displayName: 'B' }),
      createAnalysis({ userId: 'u3', displayName: 'C' }),
    ];

    const awards = generateFinaleAwards(analyses, 3, seededRandom);
    const awardedUserIds = new Set(awards.map(a => a.userId));
    expect(awardedUserIds.size).toBe(3);
  });

  it('assigns performer awards only to participants who sang', () => {
    const analyses = [
      createAnalysis({ userId: 'u1', songsPerformed: 3 }),
      createAnalysis({ userId: 'u2', songsPerformed: 0 }),
    ];

    const awards = generateFinaleAwards(analyses, 2, seededRandom);
    const performerAwards = awards.filter(a => a.category === FinaleAwardCategory.performer);
    expect(performerAwards.every(a => a.userId === 'u1')).toBe(true);
  });

  it('assigns hypeLeader to user with most reactions sent', () => {
    const analyses = [
      createAnalysis({ userId: 'u1', reactionsSent: 50 }),
      createAnalysis({ userId: 'u2', reactionsSent: 10 }),
    ];

    const awards = generateFinaleAwards(analyses, 2, seededRandom);
    const hype = awards.find(a => a.category === FinaleAwardCategory.hypeLeader);
    expect(hype?.userId).toBe('u1');
  });

  it('skips socialButterfly when no cards accepted in session', () => {
    const analyses = [
      createAnalysis({ userId: 'u1', cardsAccepted: 0 }),
      createAnalysis({ userId: 'u2', cardsAccepted: 0 }),
    ];

    const awards = generateFinaleAwards(analyses, 2, seededRandom);
    const socialButterfly = awards.filter(a => a.category === FinaleAwardCategory.socialButterfly);
    expect(socialButterfly).toHaveLength(0);
  });

  it('handles all-singers session', () => {
    const analyses = [
      createAnalysis({ userId: 'u1', songsPerformed: 2, reactionsSent: 5 }),
      createAnalysis({ userId: 'u2', songsPerformed: 1, reactionsSent: 3 }),
    ];

    const awards = generateFinaleAwards(analyses, 2, seededRandom);
    expect(awards.length).toBeGreaterThanOrEqual(2);
    // Both should have performer awards
    const performers = awards.filter(a => a.category === FinaleAwardCategory.performer);
    expect(performers).toHaveLength(2);
  });

  it('handles no-singers session', () => {
    const analyses = [
      createAnalysis({ userId: 'u1', reactionsSent: 10, participationScore: 20 }),
      createAnalysis({ userId: 'u2', reactionsSent: 5, participationScore: 8 }),
    ];

    const awards = generateFinaleAwards(analyses, 2, seededRandom);
    expect(awards.length).toBeGreaterThanOrEqual(2);
    const performers = awards.filter(a => a.category === FinaleAwardCategory.performer);
    expect(performers).toHaveLength(0);
  });

  it('handles solo participant', () => {
    const analyses = [
      createAnalysis({ userId: 'u1', songsPerformed: 1, reactionsSent: 5, participationScore: 15 }),
    ];

    const awards = generateFinaleAwards(analyses, 1, seededRandom);
    expect(awards.length).toBeGreaterThanOrEqual(1);
    expect(awards[0]!.userId).toBe('u1');
  });

  it('deduplicates against per-song awards', () => {
    // Give u1 a per-song award that matches a finale template
    const analyses = [
      createAnalysis({
        userId: 'u1',
        songsPerformed: 1,
        perSongAwards: FINALE_AWARD_TEMPLATES.filter(t => t.category === FinaleAwardCategory.performer).map(t => t.title),
      }),
    ];

    const awards = generateFinaleAwards(analyses, 1, seededRandom);
    // u1 should still get an award (from fallback everyone category)
    expect(awards.length).toBeGreaterThanOrEqual(1);
    // Should NOT have any performer template titles that were already used
    const performerTitles = new Set(FINALE_AWARD_TEMPLATES.filter(t => t.category === FinaleAwardCategory.performer).map(t => t.title));
    const u1Awards = awards.filter(a => a.userId === 'u1');
    for (const a of u1Awards) {
      expect(performerTitles.has(a.title)).toBe(false);
    }
  });

  it('session-wide dedup — no two participants get same finale title', () => {
    const analyses = Array.from({ length: 12 }, (_, i) =>
      createAnalysis({
        userId: `u${i}`,
        displayName: `Player ${i}`,
        participationScore: 10 + i,
        reactionsSent: i * 2,
      }),
    );

    const awards = generateFinaleAwards(analyses, 12, seededRandom);
    const titles = awards.map(a => a.title);
    expect(new Set(titles).size).toBe(titles.length);
  });

  it('awards are sorted by category priority then participation score', () => {
    const analyses = [
      createAnalysis({ userId: 'u1', songsPerformed: 2, reactionsSent: 20, participationScore: 30 }),
      createAnalysis({ userId: 'u2', reactionsSent: 5, participationScore: 5 }),
      createAnalysis({ userId: 'u3', reactionsSent: 10, participationScore: 15 }),
    ];

    const awards = generateFinaleAwards(analyses, 3, seededRandom);

    // Check ordering: performer awards should come before hypeLeader before everyone
    let lastCatPriority = -1;
    for (const a of awards) {
      const priority = ['performer', 'hypeLeader', 'socialButterfly', 'crowdFavorite', 'partyStarter', 'vibeKeeper', 'everyone'].indexOf(a.category);
      expect(priority).toBeGreaterThanOrEqual(lastCatPriority);
      lastCatPriority = priority;
    }
  });

  it('handles participant with zero events (gets everyone category award)', () => {
    const analyses = [
      createAnalysis({
        userId: 'ghost',
        displayName: 'Ghost',
        participationScore: 0,
        reactionsSent: 0,
        songsPerformed: 0,
        distinctActionCategories: 0,
      }),
    ];

    const awards = generateFinaleAwards(analyses, 1, seededRandom);
    expect(awards.length).toBeGreaterThanOrEqual(1);
    const ghostAward = awards.find(a => a.userId === 'ghost');
    expect(ghostAward).toBeDefined();
    expect(ghostAward!.category).toBe(FinaleAwardCategory.everyone);
  });

  it('includes reason in each award with max 60 characters', () => {
    const analyses = [
      createAnalysis({ userId: 'u1', reactionsSent: 50, participationScore: 100 }),
    ];

    const awards = generateFinaleAwards(analyses, 1, seededRandom);
    for (const a of awards) {
      expect(a.reason.length).toBeGreaterThan(0);
      expect(a.reason.length).toBeLessThanOrEqual(60);
    }
  });

  it('includes displayName in each award', () => {
    const analyses = [
      createAnalysis({ userId: 'u1', displayName: 'TestUser' }),
    ];

    const awards = generateFinaleAwards(analyses, 1, seededRandom);
    for (const a of awards) {
      expect(a.displayName).toBe('TestUser');
    }
  });

  it('assigns vibeKeeper only when distinctActionCategories >= 2', () => {
    const analyses = [
      createAnalysis({ userId: 'u1', distinctActionCategories: 1, reactionsSent: 5 }),
      createAnalysis({ userId: 'u2', distinctActionCategories: 3, reactionsSent: 3 }),
    ];

    const awards = generateFinaleAwards(analyses, 2, seededRandom);
    const vibeKeeper = awards.find(a => a.category === FinaleAwardCategory.vibeKeeper);
    if (vibeKeeper) {
      expect(vibeKeeper.userId).toBe('u2');
    }
  });

  it('assigns crowdFavorite to participant with most reactions received', () => {
    const analyses = [
      createAnalysis({ userId: 'u1', reactionsReceived: 5, songsPerformed: 1 }),
      createAnalysis({ userId: 'u2', reactionsReceived: 20, songsPerformed: 2 }),
    ];

    const awards = generateFinaleAwards(analyses, 2, seededRandom);
    const crowdFav = awards.find(a => a.category === FinaleAwardCategory.crowdFavorite);
    expect(crowdFav?.userId).toBe('u2');
  });
});
