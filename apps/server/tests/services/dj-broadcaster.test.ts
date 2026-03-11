import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTestDJContext, createTestDJContextInState } from '../factories/dj-state.js';
import { DJState } from '../../src/dj-engine/types.js';

describe('dj-broadcaster', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.resetModules();
  });

  describe('buildDjStatePayload', () => {
    it('returns correct payload fields from DJContext', async () => {
      const { buildDjStatePayload } = await import('../../src/services/dj-broadcaster.js');
      const context = createTestDJContextInState(DJState.songSelection, {
        sessionId: 'session-1',
        songCount: 3,
        participantCount: 5,
        currentPerformer: 'Alice',
        timerStartedAt: 1000,
        timerDurationMs: 30000,
      });

      const payload = buildDjStatePayload(context);

      expect(payload).toEqual({
        state: 'songSelection',
        sessionId: 'session-1',
        songCount: 3,
        participantCount: 5,
        currentPerformer: 'Alice',
        timerStartedAt: 1000,
        timerDurationMs: 30000,
      });
    });

    it('returns null fields when context has null values', async () => {
      const { buildDjStatePayload } = await import('../../src/services/dj-broadcaster.js');
      const context = createTestDJContext({
        sessionId: 'session-2',
        currentPerformer: null,
        timerStartedAt: null,
        timerDurationMs: null,
      });

      const payload = buildDjStatePayload(context);

      expect(payload.currentPerformer).toBeNull();
      expect(payload.timerStartedAt).toBeNull();
      expect(payload.timerDurationMs).toBeNull();
    });

    it('does not include internal fields like cycleHistory or metadata', async () => {
      const { buildDjStatePayload } = await import('../../src/services/dj-broadcaster.js');
      const context = createTestDJContext({
        cycleHistory: [DJState.lobby, DJState.songSelection],
        metadata: { someKey: 'someValue' },
      });

      const payload = buildDjStatePayload(context);
      const keys = Object.keys(payload);

      expect(keys).toEqual([
        'state',
        'sessionId',
        'songCount',
        'participantCount',
        'currentPerformer',
        'timerStartedAt',
        'timerDurationMs',
      ]);
    });
  });

  describe('broadcastDjState', () => {
    it('emits dj:stateChanged to session room via io.to()', async () => {
      const mockEmit = vi.fn();
      const mockIo = {
        to: vi.fn().mockReturnValue({ emit: mockEmit }),
      };

      const { initDjBroadcaster, broadcastDjState } = await import('../../src/services/dj-broadcaster.js');
      initDjBroadcaster(mockIo as never);

      const context = createTestDJContextInState(DJState.song, {
        sessionId: 'session-1',
        songCount: 2,
        participantCount: 4,
        currentPerformer: 'Bob',
        timerStartedAt: 5000,
        timerDurationMs: 180000,
      });

      broadcastDjState('session-1', context);

      expect(mockIo.to).toHaveBeenCalledWith('session-1');
      expect(mockEmit).toHaveBeenCalledWith('dj:stateChanged', {
        state: 'song',
        sessionId: 'session-1',
        songCount: 2,
        participantCount: 4,
        currentPerformer: 'Bob',
        timerStartedAt: 5000,
        timerDurationMs: 180000,
      });
    });

    it('warns and returns when io is not initialized', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { broadcastDjState } = await import('../../src/services/dj-broadcaster.js');
      const context = createTestDJContext({ sessionId: 'session-1' });

      broadcastDjState('session-1', context);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot broadcast'),
      );
      warnSpy.mockRestore();
    });
  });
});
