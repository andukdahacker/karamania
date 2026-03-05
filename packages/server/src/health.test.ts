import { describe, it, expect } from 'vitest';
import { healthHandler } from './health.js';

describe('health module', () => {
  it('exports healthHandler function', () => {
    expect(typeof healthHandler).toBe('function');
  });
});
