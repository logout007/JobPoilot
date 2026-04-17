// ============================================================
// Unit Tests for withRetry utility
// Requirements: 9.1–9.5
// ============================================================

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { withRetry, delay } from '../../src/shared/retry.js';

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('should return result immediately on first attempt success', async () => {
    const fn = vi.fn().mockResolvedValue('success');

    const promise = withRetry(fn, 3, 2000);
    const result = await promise;

    expect(result).toBe('success');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should succeed on second attempt after one failure', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('transient failure'))
      .mockResolvedValueOnce('recovered');

    const promise = withRetry(fn, 3, 2000);

    // Advance past the first retry delay (2000ms)
    await vi.advanceTimersByTimeAsync(2000);

    const result = await promise;

    expect(result).toBe('recovered');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should throw last error after all attempts exhausted', async () => {
    vi.useRealTimers(); // Use real timers to avoid unhandled rejection timing issues

    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('fail 1'))
      .mockRejectedValueOnce(new Error('fail 2'))
      .mockRejectedValueOnce(new Error('fail 3'));

    await expect(withRetry(fn, 3, 10)).rejects.toThrow('fail 3');
    expect(fn).toHaveBeenCalledTimes(3);
  });

  it('should use exponential back-off delays between attempts', async () => {
    // Use real timers for this test to measure actual delay behavior
    vi.useRealTimers();

    const callTimes = [];
    const fn = vi.fn().mockImplementation(() => {
      callTimes.push(Date.now());
      return Promise.reject(new Error('fail'));
    });

    // Use very small delays for testing
    await expect(withRetry(fn, 3, 50)).rejects.toThrow('fail');

    expect(fn).toHaveBeenCalledTimes(3);

    // Verify delays are approximately exponential
    // Delay 1: ~50ms (baseDelay * 2^0)
    // Delay 2: ~100ms (baseDelay * 2^1)
    const delay1 = callTimes[1] - callTimes[0];
    const delay2 = callTimes[2] - callTimes[1];

    expect(delay1).toBeGreaterThanOrEqual(40);
    expect(delay1).toBeLessThan(150);
    expect(delay2).toBeGreaterThanOrEqual(80);
    expect(delay2).toBeLessThan(250);
    // Second delay should be roughly double the first
    expect(delay2).toBeGreaterThan(delay1 * 1.3);
  });

  it('should log attempt number with label when provided', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new Error('oops'))
      .mockResolvedValueOnce('ok');

    const promise = withRetry(fn, 3, 2000, 'LinkedIn');
    await vi.advanceTimersByTimeAsync(2000);
    await promise;

    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('[Retry:LinkedIn]'),
    );
    expect(console.log).toHaveBeenCalledWith(
      expect.stringContaining('Attempt 1/3 failed'),
    );
  });
});
