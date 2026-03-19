import { describe, it, expect, afterEach } from 'vitest';
import {
  dealPrompt,
  clearSession,
  resetAll,
  SINGALONG_PROMPTS,
} from '../../src/services/singalong-dealer.js';

describe('singalong-dealer service', () => {
  afterEach(() => {
    resetAll();
  });

  describe('SINGALONG_PROMPTS pool', () => {
    it('has at least 20 prompts', () => {
      expect(SINGALONG_PROMPTS.length).toBeGreaterThanOrEqual(20);
    });

    it('all prompts have non-empty id, title, lyric, emoji', () => {
      for (const prompt of SINGALONG_PROMPTS) {
        expect(prompt.id).toBeTruthy();
        expect(prompt.title).toBeTruthy();
        expect(prompt.lyric).toBeTruthy();
        expect(prompt.emoji).toBeTruthy();
      }
    });

    it('all prompt ids are unique', () => {
      const ids = SINGALONG_PROMPTS.map(p => p.id);
      expect(new Set(ids).size).toBe(ids.length);
    });
  });

  describe('dealPrompt', () => {
    it('returns a valid prompt from the pool', () => {
      const prompt = dealPrompt('session-1');
      const poolIds = SINGALONG_PROMPTS.map(p => p.id);
      expect(poolIds).toContain(prompt.id);
      expect(prompt.title).toBeTruthy();
      expect(prompt.lyric).toBeTruthy();
      expect(prompt.emoji).toBeTruthy();
    });

    it('does not deal the same prompt twice in a row for the same session', () => {
      const first = dealPrompt('session-1');
      const second = dealPrompt('session-1');
      expect(second.id).not.toBe(first.id);
    });

    it('can deal prompts to different sessions independently', () => {
      const prompt1 = dealPrompt('session-1');
      const prompt2 = dealPrompt('session-2');
      expect(prompt1.id).toBeTruthy();
      expect(prompt2.id).toBeTruthy();
    });

    it('allows repeat after clearSession by removing last-dealt filter', () => {
      const first = dealPrompt('session-1');
      // Without clear, second deal must differ from first
      const second = dealPrompt('session-1');
      expect(second.id).not.toBe(first.id);
      // After clear, the first prompt's id is no longer excluded from the pool
      clearSession('session-1');
      // Force Math.random to return 0 so we get the first prompt in the pool deterministically
      const originalRandom = Math.random;
      const firstPromptIndex = SINGALONG_PROMPTS.findIndex(p => p.id === first.id);
      Math.random = () => firstPromptIndex / SINGALONG_PROMPTS.length;
      const afterClear = dealPrompt('session-1');
      Math.random = originalRandom;
      expect(afterClear.id).toBe(first.id);
    });
  });

  describe('clearSession', () => {
    it('resets prompt tracking for a session', () => {
      dealPrompt('session-1');
      clearSession('session-1');
      const prompt = dealPrompt('session-1');
      expect(prompt.id).toBeTruthy();
    });

    it('does not affect other sessions', () => {
      dealPrompt('session-1');
      dealPrompt('session-2');
      clearSession('session-1');
      const s2Next = dealPrompt('session-2');
      expect(s2Next.id).toBeTruthy();
      const s1Next = dealPrompt('session-1');
      expect(s1Next.id).toBeTruthy();
    });
  });

  describe('resetAll', () => {
    it('clears all session data', () => {
      dealPrompt('session-1');
      dealPrompt('session-2');
      resetAll();
      const prompt1 = dealPrompt('session-1');
      const prompt2 = dealPrompt('session-2');
      expect(prompt1.id).toBeTruthy();
      expect(prompt2.id).toBeTruthy();
    });
  });
});
