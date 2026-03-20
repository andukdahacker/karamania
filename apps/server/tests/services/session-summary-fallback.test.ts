import { describe, it, expect, vi, beforeEach } from 'vitest';
import type { SessionSummary } from '../../src/services/session-summary-builder.js';

const mockMkdir = vi.fn().mockResolvedValue(undefined);
const mockWriteFile = vi.fn().mockResolvedValue(undefined);

vi.mock('node:fs/promises', () => ({
  default: {
    mkdir: (...args: unknown[]) => mockMkdir(...args),
    writeFile: (...args: unknown[]) => mockWriteFile(...args),
  },
}));

const createTestSummary = (): SessionSummary => ({
  version: 1,
  generatedAt: 1710936000000,
  stats: {
    songCount: 5, participantCount: 3, sessionDurationMs: 3600000,
    totalReactions: 20, totalSoundboardPlays: 5, totalCardsDealt: 4,
    topReactor: { displayName: 'Alice', count: 10 }, longestStreak: 3,
  },
  setlist: [],
  awards: [],
  participants: [],
});

describe('session-summary-fallback', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('writes JSON file to correct path', async () => {
    const { writeSessionSummaryToDisk } = await import('../../src/services/session-summary-fallback.js');
    const summary = createTestSummary();

    await writeSessionSummaryToDisk('session-123', summary);

    expect(mockWriteFile).toHaveBeenCalledTimes(1);
    const [filePath, content, options] = mockWriteFile.mock.calls[0] as [string, string, { flag: string }];
    expect(filePath).toContain('session-123.json');
    expect(options).toEqual({ flag: 'wx' });
    const parsed = JSON.parse(content);
    expect(parsed.sessionId).toBe('session-123');
    expect(parsed.summary).toEqual(summary);
    expect(parsed.writtenAt).toBeDefined();
  });

  it('creates directory if not exists', async () => {
    const { writeSessionSummaryToDisk } = await import('../../src/services/session-summary-fallback.js');

    await writeSessionSummaryToDisk('session-1', createTestSummary());

    expect(mockMkdir).toHaveBeenCalledTimes(1);
    const [dirPath, options] = mockMkdir.mock.calls[0] as [string, { recursive: boolean }];
    expect(dirPath).toContain('failed-summaries');
    expect(options).toEqual({ recursive: true });
  });

  it('logs to stderr if file write fails', async () => {
    mockWriteFile.mockRejectedValueOnce(new Error('disk full'));
    const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const { writeSessionSummaryToDisk } = await import('../../src/services/session-summary-fallback.js');
    await writeSessionSummaryToDisk('session-fail', createTestSummary());

    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[SessionSummaryFallback] Disk write also failed'),
      expect.any(Error),
    );
    expect(consoleSpy).toHaveBeenCalledWith(
      expect.stringContaining('[SessionSummaryFallback] Full summary JSON:'),
      expect.stringContaining('session-fail'),
    );

    consoleSpy.mockRestore();
  });

  it('does not overwrite existing files (wx flag)', async () => {
    const { writeSessionSummaryToDisk } = await import('../../src/services/session-summary-fallback.js');
    await writeSessionSummaryToDisk('session-1', createTestSummary());

    const [, , options] = mockWriteFile.mock.calls[0] as [string, string, { flag: string }];
    expect(options.flag).toBe('wx');
  });
});
