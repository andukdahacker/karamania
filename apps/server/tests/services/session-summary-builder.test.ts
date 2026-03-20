import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildSessionSummary, type BuildSummaryInput } from '../../src/services/session-summary-builder.js';

function createDefaultInput(overrides?: Partial<BuildSummaryInput>): BuildSummaryInput {
  return {
    sessionId: 'session-1',
    stats: {
      songCount: 5,
      participantCount: 4,
      sessionDurationMs: 3600000,
      totalReactions: 42,
      totalSoundboardPlays: 10,
      totalCardsDealt: 8,
      topReactor: { displayName: 'Alice', count: 15 },
      longestStreak: 7,
    },
    setlist: [
      { position: 1, title: 'Bohemian Rhapsody', artist: 'Queen', performerName: 'Alice', awardTitle: 'Vocal Legend', awardTone: 'hype' },
      { position: 2, title: 'Sweet Caroline', artist: 'Neil Diamond', performerName: 'Bob', awardTitle: null, awardTone: null },
    ],
    awards: [
      { userId: 'user-1', displayName: 'Alice', category: 'performer' as const, title: 'Vocal Legend', tone: 'hype' as const, reason: 'Nailed every high note' },
      { userId: 'user-2', displayName: 'Bob', category: 'hypeLeader' as const, title: 'Hype Machine', tone: 'comedic' as const, reason: 'Never stopped cheering' },
    ],
    participants: [
      { userId: 'user-1', displayName: 'Alice', participationScore: 120, topAward: 'Vocal Legend' },
      { userId: 'user-2', displayName: 'Bob', participationScore: 85, topAward: 'Hype Machine' },
      { userId: null, displayName: 'Guest Charlie', participationScore: 30, topAward: null },
    ],
    ...overrides,
  };
}

describe('session-summary-builder', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-20T12:00:00Z'));
  });

  it('builds complete summary with all fields populated', () => {
    const input = createDefaultInput();
    const result = buildSessionSummary(input);

    expect(result.version).toBe(1);
    expect(result.generatedAt).toBe(Date.now());
    expect(result.stats.songCount).toBe(5);
    expect(result.stats.participantCount).toBe(4);
    expect(result.stats.sessionDurationMs).toBe(3600000);
    expect(result.stats.totalReactions).toBe(42);
    expect(result.stats.totalSoundboardPlays).toBe(10);
    expect(result.stats.totalCardsDealt).toBe(8);
    expect(result.stats.topReactor).toEqual({ displayName: 'Alice', count: 15 });
    expect(result.stats.longestStreak).toBe(7);
    expect(result.setlist).toHaveLength(2);
    expect(result.setlist[0]).toEqual({
      position: 1, title: 'Bohemian Rhapsody', artist: 'Queen',
      performerName: 'Alice', awardTitle: 'Vocal Legend', awardTone: 'hype',
    });
    expect(result.awards).toHaveLength(2);
    expect(result.awards[0]).toEqual({
      userId: 'user-1', displayName: 'Alice', category: 'performer',
      title: 'Vocal Legend', tone: 'hype', reason: 'Nailed every high note',
    });
    expect(result.participants).toHaveLength(3);
  });

  it('handles empty setlist (no songs played)', () => {
    const input = createDefaultInput({ setlist: [] });
    const result = buildSessionSummary(input);

    expect(result.setlist).toEqual([]);
  });

  it('handles empty awards (party ended before awards)', () => {
    const input = createDefaultInput({ awards: [] });
    const result = buildSessionSummary(input);

    expect(result.awards).toEqual([]);
  });

  it('handles null topReactor in stats', () => {
    const input = createDefaultInput({
      stats: {
        songCount: 0, participantCount: 1, sessionDurationMs: 0,
        totalReactions: 0, totalSoundboardPlays: 0, totalCardsDealt: 0,
        topReactor: null, longestStreak: 0,
      },
    });
    const result = buildSessionSummary(input);

    expect(result.stats.topReactor).toBeNull();
  });

  it('handles mixed authenticated + guest participants', () => {
    const input = createDefaultInput({
      participants: [
        { userId: 'user-1', displayName: 'Alice', participationScore: 100, topAward: 'Star' },
        { userId: null, displayName: 'Guest Bob', participationScore: 50, topAward: null },
      ],
    });
    const result = buildSessionSummary(input);

    expect(result.participants[0]!.userId).toBe('user-1');
    expect(result.participants[1]!.userId).toBeNull();
    expect(result.participants[1]!.topAward).toBeNull();
  });

  it('summary version is always 1', () => {
    const result = buildSessionSummary(createDefaultInput());
    expect(result.version).toBe(1);
  });

  it('generatedAt is a valid timestamp', () => {
    vi.useRealTimers();
    const before = Date.now();
    const result = buildSessionSummary(createDefaultInput());
    const after = Date.now();

    expect(result.generatedAt).toBeGreaterThanOrEqual(before);
    expect(result.generatedAt).toBeLessThanOrEqual(after);
  });
});
