/**
 * Retry policy and backoff helpers.
 *
 * Only *safe* operations (list/get/check) are retried by default, and only on
 * transient failures (network errors, HTTP 429/503/502/504), with exponential
 * backoff + full jitter and respect for `Retry-After`. Mutating RPCs are not
 * auto-retried unless the caller opts in, since they are not idempotent
 * (topic-reliability, topic-api-consumption).
 *
 * @packageDocumentation
 */

/** Tunable retry parameters. */
export interface RetryPolicy {
  /** Maximum retries *after* the initial attempt. `0` disables retrying. */
  readonly maxRetries: number;
  /** Base backoff delay in milliseconds. */
  readonly baseDelayMs: number;
  /** Ceiling for a single backoff delay in milliseconds. */
  readonly maxDelayMs: number;
}

/** Conservative default: two retries, 250ms base, capped at 4s. */
export const DEFAULT_RETRY_POLICY: RetryPolicy = {
  maxRetries: 2,
  baseDelayMs: 250,
  maxDelayMs: 4000,
};

/** HTTP statuses treated as transient/retryable. */
const RETRYABLE_STATUS = new Set([429, 502, 503, 504]);

/**
 * Whether a response status should be retried (for safe operations).
 *
 * @param status - HTTP status code.
 * @returns `true` if transient.
 */
export function isRetryableStatus(status: number): boolean {
  return RETRYABLE_STATUS.has(status);
}

/**
 * Compute the backoff delay for a given retry attempt using exponential growth
 * with full jitter, honouring a server `Retry-After` hint as a floor.
 *
 * @param attempt - 1-based retry number (1 for the first retry).
 * @param policy - The active {@link RetryPolicy}.
 * @param options - Optional `retryAfterMs` floor and a deterministic `random`.
 * @returns Delay in milliseconds (>= 0).
 */
export function backoffDelay(
  attempt: number,
  policy: RetryPolicy,
  options?: { retryAfterMs?: number | undefined; random?: () => number },
): number {
  const random = options?.random ?? Math.random;
  const exp = policy.baseDelayMs * 2 ** (attempt - 1);
  const capped = Math.min(policy.maxDelayMs, exp);
  const jittered = random() * capped;
  return Math.max(jittered, options?.retryAfterMs ?? 0);
}

/**
 * Parse a `Retry-After` header (seconds form only) into milliseconds.
 *
 * @param header - Raw header value, or `undefined`.
 * @returns Milliseconds, or `undefined` if absent/unparseable.
 */
export function parseRetryAfterMs(header: string | undefined): number | undefined {
  if (header === undefined) {
    return undefined;
  }
  const seconds = Number(header.trim());
  if (Number.isFinite(seconds) && seconds >= 0) {
    return seconds * 1000;
  }
  return undefined;
}

/**
 * Sleep for `ms`, rejecting early if the optional signal aborts.
 *
 * @param ms - Milliseconds to wait.
 * @param signal - Optional cancellation signal.
 * @returns A promise that resolves after the delay.
 */
export function sleep(ms: number, signal?: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    if (signal?.aborted) {
      reject(new Error('aborted'));
      return;
    }
    const timer = setTimeout(() => {
      signal?.removeEventListener('abort', onAbort);
      resolve();
    }, ms);
    const onAbort = (): void => {
      clearTimeout(timer);
      reject(new Error('aborted'));
    };
    signal?.addEventListener('abort', onAbort, { once: true });
  });
}
