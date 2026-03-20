import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry } from '../../src/services/retry.js';

describe('retry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('succeeds on first attempt — no retry', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const onRetry = vi.fn();

    const result = await withRetry(fn, { maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 5000, onRetry });

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
    expect(onRetry).not.toHaveBeenCalled();
  });

  it('succeeds on second attempt after one failure', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok');
    const onRetry = vi.fn();

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 5000, onRetry });

    // Advance past the first delay (500ms)
    await vi.advanceTimersByTimeAsync(500);

    const result = await promise;
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenCalledTimes(1);
    expect(onRetry).toHaveBeenCalledWith(1, expect.any(Error));
  });

  it('exhausts all retries and throws last error', async () => {
    const error1 = new Error('fail-1');
    const error2 = new Error('fail-2');
    const error3 = new Error('fail-3');
    const fn = vi.fn()
      .mockRejectedValueOnce(error1)
      .mockRejectedValueOnce(error2)
      .mockRejectedValueOnce(error3);

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 500, maxDelayMs: 5000 });

    // Attach catch handler immediately to prevent unhandled rejection
    const resultPromise = promise.catch((e: unknown) => e);

    // Advance through all delays
    await vi.advanceTimersByTimeAsync(500);  // delay after attempt 1
    await vi.advanceTimersByTimeAsync(1000); // delay after attempt 2

    const result = await resultPromise;
    expect(result).toBeInstanceOf(Error);
    expect((result as Error).message).toBe('fail-3');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('exponential delay increases correctly', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { maxAttempts: 4, baseDelayMs: 100, maxDelayMs: 5000 });

    // Attempt 1 fails, delay = 100ms
    await vi.advanceTimersByTimeAsync(100);
    expect(fn).toHaveBeenCalledTimes(2);

    // Attempt 2 fails, delay = 200ms
    await vi.advanceTimersByTimeAsync(200);
    expect(fn).toHaveBeenCalledTimes(3);

    // Attempt 3 fails, delay = 400ms
    await vi.advanceTimersByTimeAsync(400);
    expect(fn).toHaveBeenCalledTimes(4);

    const result = await promise;
    expect(result).toBe('ok');
  });

  it('onRetry callback called with correct attempt number', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('e1'))
      .mockRejectedValueOnce(new Error('e2'))
      .mockResolvedValueOnce('ok');
    const onRetry = vi.fn();

    const promise = withRetry(fn, { maxAttempts: 3, baseDelayMs: 100, maxDelayMs: 5000, onRetry });

    await vi.advanceTimersByTimeAsync(100);
    await vi.advanceTimersByTimeAsync(200);

    await promise;

    expect(onRetry).toHaveBeenCalledTimes(2);
    expect(onRetry).toHaveBeenNthCalledWith(1, 1, expect.any(Error));
    expect(onRetry).toHaveBeenNthCalledWith(2, 2, expect.any(Error));
  });

  it('respects maxDelayMs cap', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockRejectedValueOnce(new Error('fail'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, { maxAttempts: 4, baseDelayMs: 1000, maxDelayMs: 1500 });

    // Attempt 1 fails, delay = min(1000, 1500) = 1000ms
    await vi.advanceTimersByTimeAsync(1000);
    expect(fn).toHaveBeenCalledTimes(2);

    // Attempt 2 fails, delay = min(2000, 1500) = 1500ms (capped)
    await vi.advanceTimersByTimeAsync(1500);
    expect(fn).toHaveBeenCalledTimes(3);

    // Attempt 3 fails, delay = min(4000, 1500) = 1500ms (capped)
    await vi.advanceTimersByTimeAsync(1500);
    expect(fn).toHaveBeenCalledTimes(4);

    await promise;
  });
});
