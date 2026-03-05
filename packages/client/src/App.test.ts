import { describe, it, expect } from 'vitest';

describe('App component', () => {
  it('App module exists', async () => {
    const module = await import('./App.svelte');
    expect(module.default).toBeDefined();
  });
});
