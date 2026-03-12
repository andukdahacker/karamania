import { describe, it, expect, beforeEach } from 'vitest';
import {
  appendEvent,
  getEventStream,
  flushEventStream,
  removeEventStream,
  clearAllStreams,
} from '../../src/services/event-stream.js';
import type { SessionEvent } from '../../src/services/event-stream.js';

describe('event-stream', () => {
  beforeEach(() => {
    clearAllStreams();
  });

  describe('appendEvent', () => {
    it('adds event to correct session stream', () => {
      const event: SessionEvent = {
        type: 'party:started',
        ts: 1000,
        userId: 'user-1',
        data: { participantCount: 5 },
      };
      appendEvent('session-1', event);
      const events = getEventStream('session-1');
      expect(events).toHaveLength(1);
      expect(events[0]).toEqual(event);
    });

    it('creates new stream if not exists', () => {
      appendEvent('new-session', {
        type: 'party:started',
        ts: 1000,
        userId: 'user-1',
        data: { participantCount: 3 },
      });
      expect(getEventStream('new-session')).toHaveLength(1);
    });

    it('appends multiple events to same session', () => {
      appendEvent('session-1', {
        type: 'party:started',
        ts: 1000,
        userId: 'user-1',
        data: { participantCount: 3 },
      });
      appendEvent('session-1', {
        type: 'party:joined',
        ts: 1001,
        userId: 'user-2',
        data: { displayName: 'Alice', role: 'guest' },
      });
      expect(getEventStream('session-1')).toHaveLength(2);
    });
  });

  describe('getEventStream', () => {
    it('returns copy (not reference) of events array', () => {
      appendEvent('session-1', {
        type: 'party:started',
        ts: 1000,
        userId: 'user-1',
        data: { participantCount: 3 },
      });
      const events1 = getEventStream('session-1');
      const events2 = getEventStream('session-1');
      expect(events1).toEqual(events2);
      expect(events1).not.toBe(events2);
    });

    it('returns empty array for unknown session', () => {
      expect(getEventStream('nonexistent')).toEqual([]);
    });
  });

  describe('flushEventStream', () => {
    it('returns events AND removes from map', () => {
      appendEvent('session-1', {
        type: 'party:started',
        ts: 1000,
        userId: 'user-1',
        data: { participantCount: 3 },
      });
      const flushed = flushEventStream('session-1');
      expect(flushed).toHaveLength(1);
      expect(getEventStream('session-1')).toEqual([]);
    });

    it('returns empty array for unknown session', () => {
      expect(flushEventStream('nonexistent')).toEqual([]);
    });
  });

  describe('removeEventStream', () => {
    it('clears session data', () => {
      appendEvent('session-1', {
        type: 'party:started',
        ts: 1000,
        userId: 'user-1',
        data: { participantCount: 3 },
      });
      removeEventStream('session-1');
      expect(getEventStream('session-1')).toEqual([]);
    });
  });

  describe('clearAllStreams', () => {
    it('empties all data', () => {
      appendEvent('session-1', {
        type: 'party:started',
        ts: 1000,
        userId: 'user-1',
        data: { participantCount: 3 },
      });
      appendEvent('session-2', {
        type: 'party:started',
        ts: 1001,
        userId: 'user-2',
        data: { participantCount: 4 },
      });
      clearAllStreams();
      expect(getEventStream('session-1')).toEqual([]);
      expect(getEventStream('session-2')).toEqual([]);
    });
  });

  describe('multiple sessions', () => {
    it('have independent streams', () => {
      appendEvent('session-1', {
        type: 'party:started',
        ts: 1000,
        userId: 'user-1',
        data: { participantCount: 3 },
      });
      appendEvent('session-2', {
        type: 'party:joined',
        ts: 1001,
        userId: 'user-2',
        data: { displayName: 'Bob', role: 'authenticated' },
      });
      expect(getEventStream('session-1')).toHaveLength(1);
      expect(getEventStream('session-1')[0].type).toBe('party:started');
      expect(getEventStream('session-2')).toHaveLength(1);
      expect(getEventStream('session-2')[0].type).toBe('party:joined');
    });
  });

  describe('event ordering', () => {
    it('preserves FIFO order', () => {
      const events: SessionEvent[] = [
        { type: 'party:started', ts: 1000, userId: 'user-1', data: { participantCount: 3 } },
        { type: 'party:joined', ts: 1001, userId: 'user-2', data: { displayName: 'Alice', role: 'guest' } },
        { type: 'dj:stateChanged', ts: 1002, userId: 'user-1', data: { from: 'lobby', to: 'songSelection', trigger: 'SESSION_STARTED' } },
      ];
      for (const event of events) {
        appendEvent('session-1', event);
      }
      const result = getEventStream('session-1');
      expect(result).toEqual(events);
    });
  });

  describe('performance', () => {
    it('appends 1000 events in <5ms', () => {
      const start = performance.now();
      for (let i = 0; i < 1000; i++) {
        appendEvent('perf-session', {
          type: 'party:joined',
          ts: i,
          userId: `user-${i}`,
          data: { displayName: `User ${i}`, role: 'guest' },
        });
      }
      const elapsed = performance.now() - start;
      expect(elapsed).toBeLessThan(5);
      expect(getEventStream('perf-session')).toHaveLength(1000);
    });
  });
});
