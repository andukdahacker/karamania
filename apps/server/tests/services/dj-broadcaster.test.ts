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
        isPaused: false,
        pausedFromState: null,
        timerRemainingMs: null,
        ceremonyType: null,
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
        'isPaused',
        'pausedFromState',
        'timerRemainingMs',
        'ceremonyType',
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
        isPaused: false,
        pausedFromState: null,
        timerRemainingMs: null,
        ceremonyType: null,
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

  describe('buildDjStatePayload includes isPaused', () => {
    it('includes isPaused: true when context is paused', async () => {
      const { buildDjStatePayload } = await import('../../src/services/dj-broadcaster.js');
      const context = createTestDJContextInState(DJState.song, {
        sessionId: 'session-1',
        isPaused: true,
      });

      const payload = buildDjStatePayload(context);
      expect(payload.isPaused).toBe(true);
    });

    it('includes isPaused: false when context is not paused', async () => {
      const { buildDjStatePayload } = await import('../../src/services/dj-broadcaster.js');
      const context = createTestDJContext({ sessionId: 'session-1' });

      const payload = buildDjStatePayload(context);
      expect(payload.isPaused).toBe(false);
    });
  });

  describe('ceremonyType in broadcast payload', () => {
    it('includes ceremonyType from metadata when state is ceremony', async () => {
      const { buildDjStatePayload } = await import('../../src/services/dj-broadcaster.js');
      const context = createTestDJContextInState(DJState.ceremony, {
        sessionId: 'session-1',
        metadata: { ceremonyType: 'full', lastCeremonyType: 'full' },
      });

      const payload = buildDjStatePayload(context);
      expect(payload.ceremonyType).toBe('full');
    });

    it('returns null ceremonyType when state is not ceremony', async () => {
      const { buildDjStatePayload } = await import('../../src/services/dj-broadcaster.js');
      const context = createTestDJContextInState(DJState.song, {
        sessionId: 'session-1',
        metadata: { ceremonyType: 'full', lastCeremonyType: 'full' },
      });

      const payload = buildDjStatePayload(context);
      expect(payload.ceremonyType).toBeNull();
    });
  });

  describe('broadcastDjPause', () => {
    it('emits dj:pause with correct payload', async () => {
      const mockEmit = vi.fn();
      const mockIo = {
        to: vi.fn().mockReturnValue({ emit: mockEmit }),
      };

      const { initDjBroadcaster, broadcastDjPause } = await import('../../src/services/dj-broadcaster.js');
      initDjBroadcaster(mockIo as never);

      const context = createTestDJContextInState(DJState.song, {
        sessionId: 'session-1',
        isPaused: true,
        pausedFromState: DJState.song,
        timerRemainingMs: 15000,
      });

      broadcastDjPause('session-1', context);

      expect(mockIo.to).toHaveBeenCalledWith('session-1');
      expect(mockEmit).toHaveBeenCalledWith('dj:pause', {
        isPaused: true,
        pausedFromState: DJState.song,
        timerRemainingMs: 15000,
      });
    });

    it('warns when io is not initialized', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { broadcastDjPause } = await import('../../src/services/dj-broadcaster.js');
      const context = createTestDJContext({ sessionId: 'session-1' });

      broadcastDjPause('session-1', context);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot broadcast'),
      );
      warnSpy.mockRestore();
    });
  });

  describe('broadcastDjResume', () => {
    it('emits dj:resume with full state payload', async () => {
      const mockEmit = vi.fn();
      const mockIo = {
        to: vi.fn().mockReturnValue({ emit: mockEmit }),
      };

      const { initDjBroadcaster, broadcastDjResume } = await import('../../src/services/dj-broadcaster.js');
      initDjBroadcaster(mockIo as never);

      const context = createTestDJContextInState(DJState.song, {
        sessionId: 'session-1',
        isPaused: false,
        timerStartedAt: 5000,
        timerDurationMs: 15000,
      });

      broadcastDjResume('session-1', context);

      expect(mockIo.to).toHaveBeenCalledWith('session-1');
      expect(mockEmit).toHaveBeenCalledWith('dj:resume', expect.objectContaining({
        state: 'song',
        sessionId: 'session-1',
        isPaused: false,
      }));
    });

    it('warns when io is not initialized', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { broadcastDjResume } = await import('../../src/services/dj-broadcaster.js');
      const context = createTestDJContext({ sessionId: 'session-1' });

      broadcastDjResume('session-1', context);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot broadcast'),
      );
      warnSpy.mockRestore();
    });
  });

  describe('broadcastCeremonyAnticipation', () => {
    it('emits ceremony:anticipation to session room with correct payload', async () => {
      const mockEmit = vi.fn();
      const mockIo = {
        to: vi.fn().mockReturnValue({ emit: mockEmit }),
      };

      const { initDjBroadcaster, broadcastCeremonyAnticipation } = await import('../../src/services/dj-broadcaster.js');
      initDjBroadcaster(mockIo as never);

      broadcastCeremonyAnticipation('session-1', {
        performerName: 'Alice',
        revealAt: 1234567890,
      });

      expect(mockIo.to).toHaveBeenCalledWith('session-1');
      expect(mockEmit).toHaveBeenCalledWith('ceremony:anticipation', {
        performerName: 'Alice',
        revealAt: 1234567890,
      });
    });

    it('broadcasts with performerName: null', async () => {
      const mockEmit = vi.fn();
      const mockIo = {
        to: vi.fn().mockReturnValue({ emit: mockEmit }),
      };

      const { initDjBroadcaster, broadcastCeremonyAnticipation } = await import('../../src/services/dj-broadcaster.js');
      initDjBroadcaster(mockIo as never);

      broadcastCeremonyAnticipation('session-1', {
        performerName: null,
        revealAt: 1234567890,
      });

      expect(mockEmit).toHaveBeenCalledWith('ceremony:anticipation', {
        performerName: null,
        revealAt: 1234567890,
      });
    });

    it('warns when io is not initialized', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { broadcastCeremonyAnticipation } = await import('../../src/services/dj-broadcaster.js');
      broadcastCeremonyAnticipation('session-1', {
        performerName: null,
        revealAt: 1234567890,
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot broadcast'),
      );
      warnSpy.mockRestore();
    });
  });

  describe('broadcastCeremonyReveal', () => {
    it('emits ceremony:reveal to session room with correct payload', async () => {
      const mockEmit = vi.fn();
      const mockIo = {
        to: vi.fn().mockReturnValue({ emit: mockEmit }),
      };

      const { initDjBroadcaster, broadcastCeremonyReveal } = await import('../../src/services/dj-broadcaster.js');
      initDjBroadcaster(mockIo as never);

      broadcastCeremonyReveal('session-1', {
        award: 'Mic Drop Master',
        performerName: 'Bob',
        tone: 'hype',
        songTitle: null,
      });

      expect(mockIo.to).toHaveBeenCalledWith('session-1');
      expect(mockEmit).toHaveBeenCalledWith('ceremony:reveal', {
        award: 'Mic Drop Master',
        performerName: 'Bob',
        tone: 'hype',
        songTitle: null,
      });
    });

    it('broadcasts with songTitle when provided', async () => {
      const mockEmit = vi.fn();
      const mockIo = {
        to: vi.fn().mockReturnValue({ emit: mockEmit }),
      };

      const { initDjBroadcaster, broadcastCeremonyReveal } = await import('../../src/services/dj-broadcaster.js');
      initDjBroadcaster(mockIo as never);

      broadcastCeremonyReveal('session-1', {
        award: 'Mic Drop Master',
        performerName: 'Bob',
        tone: 'hype',
        songTitle: 'Bohemian Rhapsody',
      });

      expect(mockEmit).toHaveBeenCalledWith('ceremony:reveal', {
        award: 'Mic Drop Master',
        performerName: 'Bob',
        tone: 'hype',
        songTitle: 'Bohemian Rhapsody',
      });
    });

    it('warns when io is not initialized', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { broadcastCeremonyReveal } = await import('../../src/services/dj-broadcaster.js');
      broadcastCeremonyReveal('session-1', {
        award: 'Star of the Show',
        performerName: null,
        tone: 'hype',
        songTitle: null,
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot broadcast'),
      );
      warnSpy.mockRestore();
    });
  });

  describe('broadcastCeremonyQuick', () => {
    it('emits ceremony:quick to session room with correct payload', async () => {
      const mockEmit = vi.fn();
      const mockIo = {
        to: vi.fn().mockReturnValue({ emit: mockEmit }),
      };

      const { initDjBroadcaster, broadcastCeremonyQuick } = await import('../../src/services/dj-broadcaster.js');
      initDjBroadcaster(mockIo as never);

      broadcastCeremonyQuick('session-1', {
        award: 'Mic Drop Master',
        performerName: 'Alice',
        tone: 'hype',
      });

      expect(mockIo.to).toHaveBeenCalledWith('session-1');
      expect(mockEmit).toHaveBeenCalledWith('ceremony:quick', {
        award: 'Mic Drop Master',
        performerName: 'Alice',
        tone: 'hype',
      });
    });

    it('broadcasts with performerName: null', async () => {
      const mockEmit = vi.fn();
      const mockIo = {
        to: vi.fn().mockReturnValue({ emit: mockEmit }),
      };

      const { initDjBroadcaster, broadcastCeremonyQuick } = await import('../../src/services/dj-broadcaster.js');
      initDjBroadcaster(mockIo as never);

      broadcastCeremonyQuick('session-1', {
        award: 'Star of the Show',
        performerName: null,
        tone: 'comedic',
      });

      expect(mockEmit).toHaveBeenCalledWith('ceremony:quick', {
        award: 'Star of the Show',
        performerName: null,
        tone: 'comedic',
      });
    });

    it('warns when io is not initialized', async () => {
      const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});

      const { broadcastCeremonyQuick } = await import('../../src/services/dj-broadcaster.js');
      broadcastCeremonyQuick('session-1', {
        award: 'Star of the Show',
        performerName: null,
        tone: 'hype',
      });

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining('Cannot broadcast'),
      );
      warnSpy.mockRestore();
    });
  });
});
