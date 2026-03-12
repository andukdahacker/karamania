import { describe, it, expect } from 'vitest';
import { selectCeremonyType, wasPostInterlude } from '../../src/dj-engine/ceremony-selection.js';
import { CeremonyType, DJState } from '../../src/dj-engine/types.js';
import { createTestDJContext } from '../factories/dj-state.js';

describe('selectCeremonyType', () => {
  it('returns full for first song of session (songCount=1)', () => {
    const ctx = createTestDJContext({
      state: DJState.ceremony,
      songCount: 1,
      participantCount: 5,
      cycleHistory: [DJState.lobby, DJState.songSelection, DJState.song, DJState.ceremony],
    });
    expect(selectCeremonyType(ctx)).toBe(CeremonyType.full);
  });

  it('returns full for first song after interlude', () => {
    const ctx = createTestDJContext({
      state: DJState.ceremony,
      songCount: 3,
      participantCount: 5,
      cycleHistory: [
        DJState.lobby, DJState.songSelection, DJState.song, DJState.ceremony,
        DJState.interlude, DJState.songSelection, DJState.song, DJState.ceremony,
      ],
      metadata: { lastCeremonyType: CeremonyType.quick },
    });
    expect(selectCeremonyType(ctx)).toBe(CeremonyType.full);
  });

  it('returns quick when no two consecutive full ceremonies (lastCeremonyType=full)', () => {
    const ctx = createTestDJContext({
      state: DJState.ceremony,
      songCount: 3,
      participantCount: 5,
      cycleHistory: [
        DJState.lobby, DJState.songSelection, DJState.song, DJState.ceremony,
        DJState.interlude, DJState.songSelection, DJState.song, DJState.ceremony,
      ],
      metadata: { lastCeremonyType: CeremonyType.full },
    });
    expect(selectCeremonyType(ctx)).toBe(CeremonyType.quick);
  });

  it('returns quick after song 5 (songCount >= 5)', () => {
    const ctx = createTestDJContext({
      state: DJState.ceremony,
      songCount: 6,
      participantCount: 5,
      cycleHistory: [DJState.lobby, DJState.songSelection, DJState.song, DJState.ceremony],
    });
    expect(selectCeremonyType(ctx)).toBe(CeremonyType.quick);
  });

  it('returns quick at exact boundary songCount === 5', () => {
    const ctx = createTestDJContext({
      state: DJState.ceremony,
      songCount: 5,
      participantCount: 5,
      cycleHistory: [
        DJState.lobby, DJState.songSelection, DJState.song, DJState.ceremony,
        DJState.songSelection, DJState.song, DJState.ceremony,
      ],
    });
    expect(selectCeremonyType(ctx)).toBe(CeremonyType.quick);
  });

  it('returns quick for small group (<3 participants) regardless of other rules', () => {
    const ctx = createTestDJContext({
      state: DJState.ceremony,
      songCount: 1,
      participantCount: 2,
      cycleHistory: [DJState.lobby, DJState.songSelection, DJState.song, DJState.ceremony],
    });
    expect(selectCeremonyType(ctx)).toBe(CeremonyType.quick);
  });

  it('returns full when no special rules apply (default)', () => {
    const ctx = createTestDJContext({
      state: DJState.ceremony,
      songCount: 3,
      participantCount: 5,
      cycleHistory: [
        DJState.lobby, DJState.songSelection, DJState.song, DJState.ceremony,
        // No interlude before the latest songSelection
        DJState.songSelection, DJState.song, DJState.ceremony,
      ],
      metadata: { lastCeremonyType: CeremonyType.quick },
    });
    expect(selectCeremonyType(ctx)).toBe(CeremonyType.full);
  });

  // Rule priority tests
  it('rule priority: small group overrides first-song (participantCount=2, songCount=1)', () => {
    const ctx = createTestDJContext({
      state: DJState.ceremony,
      songCount: 1,
      participantCount: 2,
      cycleHistory: [DJState.lobby, DJState.songSelection, DJState.song, DJState.ceremony],
    });
    expect(selectCeremonyType(ctx)).toBe(CeremonyType.quick);
  });

  it('rule priority: consecutive-full overrides post-interlude', () => {
    const ctx = createTestDJContext({
      state: DJState.ceremony,
      songCount: 3,
      participantCount: 5,
      cycleHistory: [
        DJState.lobby, DJState.songSelection, DJState.song, DJState.ceremony,
        DJState.interlude, DJState.songSelection, DJState.song, DJState.ceremony,
      ],
      metadata: { lastCeremonyType: CeremonyType.full },
    });
    expect(selectCeremonyType(ctx)).toBe(CeremonyType.quick);
  });

  it('rule priority: songCount>=5 overrides post-interlude', () => {
    const ctx = createTestDJContext({
      state: DJState.ceremony,
      songCount: 5,
      participantCount: 5,
      cycleHistory: [
        DJState.lobby, DJState.songSelection, DJState.song, DJState.ceremony,
        DJState.interlude, DJState.songSelection, DJState.song, DJState.ceremony,
      ],
      metadata: { lastCeremonyType: CeremonyType.quick },
    });
    expect(selectCeremonyType(ctx)).toBe(CeremonyType.quick);
  });
});

describe('wasPostInterlude', () => {
  it('returns true when songSelection preceded by interlude in history', () => {
    const history = [
      DJState.lobby, DJState.songSelection, DJState.song, DJState.ceremony,
      DJState.interlude, DJState.songSelection, DJState.song, DJState.ceremony,
    ];
    expect(wasPostInterlude(history)).toBe(true);
  });

  it('returns false when songSelection preceded by ceremony (small group cycle)', () => {
    const history = [
      DJState.lobby, DJState.songSelection, DJState.song, DJState.ceremony,
      DJState.songSelection, DJState.song, DJState.ceremony,
    ];
    expect(wasPostInterlude(history)).toBe(false);
  });

  it('returns false for first cycle (songSelection preceded by lobby)', () => {
    const history = [DJState.lobby, DJState.songSelection, DJState.song, DJState.ceremony];
    expect(wasPostInterlude(history)).toBe(false);
  });

  it('returns false when no songSelection in history', () => {
    const history = [DJState.lobby];
    expect(wasPostInterlude(history)).toBe(false);
  });

  it('returns false for empty history', () => {
    expect(wasPostInterlude([])).toBe(false);
  });
});
