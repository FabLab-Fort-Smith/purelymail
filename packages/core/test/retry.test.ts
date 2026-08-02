import { describe, expect, it } from 'vitest';
import {
  DEFAULT_RETRY_POLICY,
  backoffDelay,
  isRetryableStatus,
  parseRetryAfterMs,
  sleep,
} from '../src/retry.js';

describe('isRetryableStatus', () => {
  it('flags transient statuses only', () => {
    for (const s of [429, 502, 503, 504]) {
      expect(isRetryableStatus(s)).toBe(true);
    }
    for (const s of [200, 400, 401, 404, 500]) {
      expect(isRetryableStatus(s)).toBe(false);
    }
  });
});

describe('backoffDelay', () => {
  it('grows exponentially and caps, with deterministic jitter', () => {
    const policy = { maxRetries: 5, baseDelayMs: 100, maxDelayMs: 800 };
    // random = 1 => full delay
    expect(backoffDelay(1, policy, { random: () => 1 })).toBe(100);
    expect(backoffDelay(2, policy, { random: () => 1 })).toBe(200);
    expect(backoffDelay(4, policy, { random: () => 1 })).toBe(800); // capped
    // jitter scales the value down
    expect(backoffDelay(2, policy, { random: () => 0.5 })).toBe(100);
  });

  it('uses retryAfter as a floor', () => {
    const policy = { maxRetries: 5, baseDelayMs: 100, maxDelayMs: 800 };
    expect(backoffDelay(1, policy, { random: () => 0, retryAfterMs: 5000 })).toBe(5000);
  });

  it('has a sane default policy', () => {
    expect(DEFAULT_RETRY_POLICY.maxRetries).toBeGreaterThanOrEqual(1);
  });
});

describe('parseRetryAfterMs', () => {
  it('parses seconds', () => {
    expect(parseRetryAfterMs('2')).toBe(2000);
    expect(parseRetryAfterMs(' 0 ')).toBe(0);
  });
  it('returns undefined for missing/invalid', () => {
    expect(parseRetryAfterMs(undefined)).toBeUndefined();
    expect(parseRetryAfterMs('soon')).toBeUndefined();
    expect(parseRetryAfterMs('-1')).toBeUndefined();
  });
});

describe('sleep', () => {
  it('resolves after the delay', async () => {
    await expect(sleep(1)).resolves.toBeUndefined();
  });
  it('rejects if already aborted', async () => {
    const ac = new AbortController();
    ac.abort();
    await expect(sleep(10, ac.signal)).rejects.toThrow('aborted');
  });
  it('rejects when aborted mid-wait', async () => {
    const ac = new AbortController();
    const p = sleep(1000, ac.signal);
    ac.abort();
    await expect(p).rejects.toThrow('aborted');
  });
});
