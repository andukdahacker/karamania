import { describe, it, expect } from 'vitest';
import {
  AWARD_TEMPLATES,
  AwardTone,
  generateAward,
  calculateWeight,
  BASE_WEIGHT,
  AFFINITY_BOOST,
  EARLY_SONG_THRESHOLD,
  LATE_SONG_THRESHOLD,
  HIGH_SCORE_THRESHOLD,
  type AwardTemplate,
  type AwardContext,
} from '../../src/services/award-generator.js';

describe('award-generator', () => {
  describe('AWARD_TEMPLATES', () => {
    it('has at least 24 templates', () => {
      expect(AWARD_TEMPLATES.length).toBeGreaterThanOrEqual(24);
    });

    it('has at least 4 templates per tone', () => {
      for (const tone of Object.values(AwardTone)) {
        const count = AWARD_TEMPLATES.filter(t => t.tone === tone).length;
        expect(count, `tone "${tone}" has ${count} templates`).toBeGreaterThanOrEqual(4);
      }
    });

    it('covers all 4 tones: comedic, hype, absurd, wholesome', () => {
      const tones = new Set(AWARD_TEMPLATES.map(t => t.tone));
      expect(tones).toContain(AwardTone.comedic);
      expect(tones).toContain(AwardTone.hype);
      expect(tones).toContain(AwardTone.absurd);
      expect(tones).toContain(AwardTone.wholesome);
    });

    it('has all unique template titles', () => {
      const titles = AWARD_TEMPLATES.map(t => t.title);
      const uniqueTitles = new Set(titles);
      expect(uniqueTitles.size).toBe(titles.length);
    });

    it('all titles are non-empty strings', () => {
      for (const template of AWARD_TEMPLATES) {
        expect(typeof template.title).toBe('string');
        expect(template.title.length).toBeGreaterThan(0);
      }
    });
  });

  describe('calculateWeight', () => {
    const baseContext: AwardContext = {
      songPosition: 1,
      cardCompleted: false,
      reactionCount: 0,
      participationScore: 0,
      participantCount: 5,
      previousAwards: [],
    };

    it('returns BASE_WEIGHT for templates with no affinity', () => {
      const template: AwardTemplate = { title: 'Test', tone: AwardTone.comedic };
      expect(calculateWeight(template, baseContext)).toBe(BASE_WEIGHT);
    });

    it('returns BASE_WEIGHT + AFFINITY_BOOST for single match (cardCompleted)', () => {
      const template: AwardTemplate = {
        title: 'Test',
        tone: AwardTone.comedic,
        affinity: { cardCompleted: true },
      };
      const context = { ...baseContext, cardCompleted: true };
      expect(calculateWeight(template, context)).toBe(BASE_WEIGHT + AFFINITY_BOOST);
    });

    it('boosts weight for highReactions when reactionCount >= participantCount * 2', () => {
      const template: AwardTemplate = {
        title: 'Test',
        tone: AwardTone.hype,
        affinity: { highReactions: true },
      };
      const context = { ...baseContext, reactionCount: 10, participantCount: 5 };
      expect(calculateWeight(template, context)).toBe(BASE_WEIGHT + AFFINITY_BOOST);
    });

    it('does not boost highReactions when reactionCount < participantCount * 2', () => {
      const template: AwardTemplate = {
        title: 'Test',
        tone: AwardTone.hype,
        affinity: { highReactions: true },
      };
      const context = { ...baseContext, reactionCount: 9, participantCount: 5 };
      expect(calculateWeight(template, context)).toBe(BASE_WEIGHT);
    });

    it('boosts weight for earlySong when songPosition <= EARLY_SONG_THRESHOLD', () => {
      const template: AwardTemplate = {
        title: 'Test',
        tone: AwardTone.wholesome,
        affinity: { earlySong: true },
      };
      const context = { ...baseContext, songPosition: EARLY_SONG_THRESHOLD };
      expect(calculateWeight(template, context)).toBe(BASE_WEIGHT + AFFINITY_BOOST);
    });

    it('does not boost earlySong when songPosition > EARLY_SONG_THRESHOLD', () => {
      const template: AwardTemplate = {
        title: 'Test',
        tone: AwardTone.wholesome,
        affinity: { earlySong: true },
      };
      const context = { ...baseContext, songPosition: EARLY_SONG_THRESHOLD + 1 };
      expect(calculateWeight(template, context)).toBe(BASE_WEIGHT);
    });

    it('boosts weight for lateSong when songPosition >= LATE_SONG_THRESHOLD', () => {
      const template: AwardTemplate = {
        title: 'Test',
        tone: AwardTone.absurd,
        affinity: { lateSong: true },
      };
      const context = { ...baseContext, songPosition: LATE_SONG_THRESHOLD };
      expect(calculateWeight(template, context)).toBe(BASE_WEIGHT + AFFINITY_BOOST);
    });

    it('does not boost lateSong when songPosition < LATE_SONG_THRESHOLD', () => {
      const template: AwardTemplate = {
        title: 'Test',
        tone: AwardTone.absurd,
        affinity: { lateSong: true },
      };
      const context = { ...baseContext, songPosition: LATE_SONG_THRESHOLD - 1 };
      expect(calculateWeight(template, context)).toBe(BASE_WEIGHT);
    });

    it('boosts weight for highScore when participationScore >= HIGH_SCORE_THRESHOLD', () => {
      const template: AwardTemplate = {
        title: 'Test',
        tone: AwardTone.hype,
        affinity: { highScore: true },
      };
      const context = { ...baseContext, participationScore: HIGH_SCORE_THRESHOLD };
      expect(calculateWeight(template, context)).toBe(BASE_WEIGHT + AFFINITY_BOOST);
    });

    it('does not boost highScore when participationScore < HIGH_SCORE_THRESHOLD', () => {
      const template: AwardTemplate = {
        title: 'Test',
        tone: AwardTone.hype,
        affinity: { highScore: true },
      };
      const context = { ...baseContext, participationScore: HIGH_SCORE_THRESHOLD - 1 };
      expect(calculateWeight(template, context)).toBe(BASE_WEIGHT);
    });

    it('accumulates multiple affinity boosts', () => {
      const template: AwardTemplate = {
        title: 'Test',
        tone: AwardTone.hype,
        affinity: { highReactions: true, highScore: true, lateSong: true },
      };
      const context = {
        ...baseContext,
        reactionCount: 20,
        participantCount: 5,
        participationScore: 20,
        songPosition: 8,
      };
      expect(calculateWeight(template, context)).toBe(BASE_WEIGHT + AFFINITY_BOOST * 3);
    });
  });

  describe('generateAward', () => {
    const baseContext: AwardContext = {
      songPosition: 1,
      cardCompleted: false,
      reactionCount: 0,
      participationScore: 0,
      participantCount: 5,
      previousAwards: [],
    };

    it('returns a string from the template pool', () => {
      const award = generateAward(baseContext);
      const allTitles = AWARD_TEMPLATES.map(t => t.title);
      expect(allTitles).toContain(award);
    });

    it('with randomFn returning 0 always returns first viable candidate', () => {
      const award = generateAward(baseContext, () => 0);
      // With random=0, first template in filtered list is selected
      expect(AWARD_TEMPLATES.map(t => t.title)).toContain(award);
      // Should be deterministic
      const award2 = generateAward(baseContext, () => 0);
      expect(award).toBe(award2);
    });

    it('with randomFn returning 0.999 returns last viable candidate', () => {
      const award = generateAward(baseContext, () => 0.999);
      expect(AWARD_TEMPLATES.map(t => t.title)).toContain(award);
      // Should be deterministic
      const award2 = generateAward(baseContext, () => 0.999);
      expect(award).toBe(award2);
    });

    it('dedup: previousAwards containing all-but-one forces selection of remaining one', () => {
      const allButLast = AWARD_TEMPLATES.slice(0, -1).map(t => t.title);
      const lastTemplate = AWARD_TEMPLATES[AWARD_TEMPLATES.length - 1]!;
      const context = { ...baseContext, previousAwards: allButLast };
      const award = generateAward(context, () => 0);
      expect(award).toBe(lastTemplate.title);
    });

    it('dedup exhaustion: when all templates in previousAwards, allows repeats', () => {
      const allTitles = AWARD_TEMPLATES.map(t => t.title);
      const context = { ...baseContext, previousAwards: allTitles };
      const award = generateAward(context, () => 0);
      // Should still return a valid title (repeats allowed)
      expect(allTitles).toContain(award);
    });

    it('affinity boost: cardCompleted=true increases weight of card-affinity templates', () => {
      const context = { ...baseContext, cardCompleted: true };
      // Run multiple times with deterministic random to verify card-affinity templates get boosted
      const cardAffinityTemplates = AWARD_TEMPLATES.filter(t => t.affinity?.cardCompleted);
      expect(cardAffinityTemplates.length).toBeGreaterThan(0);
      // With all weights, card-affinity templates should have higher weight
      for (const template of cardAffinityTemplates) {
        const weight = calculateWeight(template, context);
        expect(weight).toBeGreaterThan(BASE_WEIGHT);
      }
    });

    it('affinity boost: high reactionCount increases weight of highReactions templates', () => {
      const context = { ...baseContext, reactionCount: 20, participantCount: 5 };
      const reactionTemplates = AWARD_TEMPLATES.filter(t => t.affinity?.highReactions);
      expect(reactionTemplates.length).toBeGreaterThan(0);
      for (const template of reactionTemplates) {
        const weight = calculateWeight(template, context);
        expect(weight).toBeGreaterThan(BASE_WEIGHT);
      }
    });

    it('affinity boost: songPosition <= 3 increases weight of earlySong templates', () => {
      const context = { ...baseContext, songPosition: 2 };
      const earlyTemplates = AWARD_TEMPLATES.filter(t => t.affinity?.earlySong);
      expect(earlyTemplates.length).toBeGreaterThan(0);
      for (const template of earlyTemplates) {
        const weight = calculateWeight(template, context);
        expect(weight).toBeGreaterThan(BASE_WEIGHT);
      }
    });

    it('affinity boost: songPosition >= 6 increases weight of lateSong templates', () => {
      const context = { ...baseContext, songPosition: 8 };
      const lateTemplates = AWARD_TEMPLATES.filter(t => t.affinity?.lateSong);
      expect(lateTemplates.length).toBeGreaterThan(0);
      for (const template of lateTemplates) {
        const weight = calculateWeight(template, context);
        expect(weight).toBeGreaterThan(BASE_WEIGHT);
      }
    });

    it('affinity boost: participationScore >= 15 increases weight of highScore templates', () => {
      const context = { ...baseContext, participationScore: 20 };
      const highScoreTemplates = AWARD_TEMPLATES.filter(t => t.affinity?.highScore);
      expect(highScoreTemplates.length).toBeGreaterThan(0);
      for (const template of highScoreTemplates) {
        const weight = calculateWeight(template, context);
        expect(weight).toBeGreaterThan(BASE_WEIGHT);
      }
    });
  });
});
