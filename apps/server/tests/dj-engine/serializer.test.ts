import { describe, it, expect } from 'vitest';
import { serializeDJContext, deserializeDJContext } from '../../src/dj-engine/serializer.js';
import { DJState, DJEngineError } from '../../src/dj-engine/types.js';
import { createTestDJContext, createTestDJContextInState } from '../factories/dj-state.js';

describe('serializeDJContext', () => {
  it('returns a JSON-safe object', () => {
    const ctx = createTestDJContext();
    const result = serializeDJContext(ctx);
    expect(() => JSON.stringify(result)).not.toThrow();
  });

  it('preserves all fields', () => {
    const ctx = createTestDJContextInState(DJState.song, {
      songCount: 5,
      currentPerformer: 'user-123',
      timerStartedAt: 1000,
      timerDurationMs: 180_000,
      metadata: { forcedQuickCeremony: true },
    });
    const result = serializeDJContext(ctx) as Record<string, unknown>;
    expect(result.state).toBe(DJState.song);
    expect(result.songCount).toBe(5);
    expect(result.currentPerformer).toBe('user-123');
    expect(result.timerStartedAt).toBe(1000);
    expect(result.timerDurationMs).toBe(180_000);
    expect(result.metadata).toEqual({ forcedQuickCeremony: true });
  });
});

describe('deserializeDJContext', () => {
  it('reconstructs a valid DJContext', () => {
    const ctx = createTestDJContext();
    const serialized = serializeDJContext(ctx);
    const deserialized = deserializeDJContext(serialized);
    expect(deserialized).toEqual(ctx);
  });
});

describe('round-trip guarantee', () => {
  it('round-trips for every DJState', () => {
    for (const state of Object.values(DJState)) {
      const ctx = createTestDJContextInState(state as DJState);
      const roundTripped = deserializeDJContext(serializeDJContext(ctx));
      expect(roundTripped).toEqual(ctx);
    }
  });

  it('round-trips with populated metadata', () => {
    const ctx = createTestDJContext({
      state: DJState.ceremony,
      songCount: 10,
      currentPerformer: 'test-user',
      metadata: { forcedQuickCeremony: true, customKey: 'value' },
      cycleHistory: [DJState.lobby, DJState.songSelection, DJState.song, DJState.ceremony],
    });
    const roundTripped = deserializeDJContext(serializeDJContext(ctx));
    expect(roundTripped).toEqual(ctx);
  });

  it('round-trips with null fields', () => {
    const ctx = createTestDJContext({
      sessionStartedAt: null,
      currentPerformer: null,
      timerStartedAt: null,
      timerDurationMs: null,
    });
    const roundTripped = deserializeDJContext(serializeDJContext(ctx));
    expect(roundTripped).toEqual(ctx);
  });
});

describe('deserialization error handling', () => {
  it('throws on null input', () => {
    expect(() => deserializeDJContext(null)).toThrow(DJEngineError);
    expect(() => deserializeDJContext(null)).toThrow('non-null object');
  });

  it('throws on undefined input', () => {
    expect(() => deserializeDJContext(undefined)).toThrow(DJEngineError);
  });

  it('throws on non-object input', () => {
    expect(() => deserializeDJContext('string')).toThrow(DJEngineError);
    expect(() => deserializeDJContext(42)).toThrow(DJEngineError);
  });

  it('throws on invalid state', () => {
    const json = serializeDJContext(createTestDJContext());
    (json as Record<string, unknown>).state = 'invalidState';
    expect(() => deserializeDJContext(json)).toThrow(DJEngineError);
    expect(() => deserializeDJContext(json)).toThrow("Invalid DJ state: 'invalidState'");
  });

  it('throws on missing state', () => {
    const json = serializeDJContext(createTestDJContext());
    delete (json as Record<string, unknown>).state;
    expect(() => deserializeDJContext(json)).toThrow(DJEngineError);
  });

  it('throws on empty sessionId', () => {
    const json = serializeDJContext(createTestDJContext());
    (json as Record<string, unknown>).sessionId = '';
    expect(() => deserializeDJContext(json)).toThrow(DJEngineError);
    expect(() => deserializeDJContext(json)).toThrow('non-empty string');
  });

  it('throws on non-integer participantCount', () => {
    const json = serializeDJContext(createTestDJContext());
    (json as Record<string, unknown>).participantCount = 2.5;
    expect(() => deserializeDJContext(json)).toThrow(DJEngineError);
  });

  it('throws on non-integer songCount', () => {
    const json = serializeDJContext(createTestDJContext());
    (json as Record<string, unknown>).songCount = 'three';
    expect(() => deserializeDJContext(json)).toThrow(DJEngineError);
  });

  it('throws on invalid cycleHistory', () => {
    const json = serializeDJContext(createTestDJContext());
    (json as Record<string, unknown>).cycleHistory = 'not-an-array';
    expect(() => deserializeDJContext(json)).toThrow(DJEngineError);
    expect(() => deserializeDJContext(json)).toThrow('must be an array');
  });

  it('throws on invalid state in cycleHistory', () => {
    const json = serializeDJContext(createTestDJContext());
    (json as Record<string, unknown>).cycleHistory = ['lobby', 'badState'];
    expect(() => deserializeDJContext(json)).toThrow(DJEngineError);
    expect(() => deserializeDJContext(json)).toThrow('Invalid state in cycleHistory');
  });

  it('throws on invalid metadata', () => {
    const json = serializeDJContext(createTestDJContext());
    (json as Record<string, unknown>).metadata = null;
    expect(() => deserializeDJContext(json)).toThrow(DJEngineError);
    expect(() => deserializeDJContext(json)).toThrow('metadata must be a non-null object');
  });

  it('throws on array metadata', () => {
    const json = serializeDJContext(createTestDJContext());
    (json as Record<string, unknown>).metadata = [1, 2, 3];
    expect(() => deserializeDJContext(json)).toThrow(DJEngineError);
  });

  it('throws on non-string currentPerformer', () => {
    const json = serializeDJContext(createTestDJContext());
    (json as Record<string, unknown>).currentPerformer = 123;
    expect(() => deserializeDJContext(json)).toThrow(DJEngineError);
  });

  it('throws on non-number timerStartedAt', () => {
    const json = serializeDJContext(createTestDJContext());
    (json as Record<string, unknown>).timerStartedAt = 'not-a-number';
    expect(() => deserializeDJContext(json)).toThrow(DJEngineError);
  });
});
