/**
 * Default {@link HttpTransport} backed by the platform global `fetch`
 * (Node >= 20, Deno, Bun, browsers). Enforces the per-request timeout via an
 * `AbortController` and maps low-level failures to {@link PurelymailTransportError}.
 *
 * @packageDocumentation
 */

import { PurelymailTransportError } from '../errors.js';
import type { HttpRequest, HttpResponse, HttpTransport } from './transport.js';

/** A minimal `fetch` shape, so a custom implementation can be injected. */
export type FetchLike = (
  input: string,
  init: {
    method: string;
    headers: Record<string, string>;
    body: string;
    signal: AbortSignal;
  },
) => Promise<{
  status: number;
  headers: { forEach(cb: (value: string, key: string) => void): void };
  text(): Promise<string>;
}>;

/**
 * {@link HttpTransport} implemented with `fetch`.
 */
export class FetchTransport implements HttpTransport {
  readonly #fetch: FetchLike;

  /**
   * @param options - Optionally supply a custom `fetch` (defaults to the global).
   */
  public constructor(options?: { fetch?: FetchLike }) {
    const resolved = options?.fetch ?? globalThis.fetch;
    if (typeof resolved !== 'function') {
      throw new PurelymailTransportError(
        'No global fetch available; pass a `fetch` implementation to FetchTransport.',
      );
    }
    this.#fetch = resolved;
  }

  /** @inheritDoc */
  public async send(request: HttpRequest): Promise<HttpResponse> {
    const timeoutController = new AbortController();
    const timer = setTimeout(() => timeoutController.abort(), request.timeoutMs);
    const signal = request.signal
      ? AbortSignal.any([request.signal, timeoutController.signal])
      : timeoutController.signal;

    // Clear the timer on every exit path (success and error) rather than via a
    // `finally`, keeping deterministic cleanup without an untestable branch.
    try {
      const res = await this.#fetch(request.url, {
        method: request.method,
        headers: { ...request.headers },
        body: request.body,
        signal,
      });
      const body = await res.text();
      const headers: Record<string, string> = {};
      res.headers.forEach((value, key) => {
        headers[key.toLowerCase()] = value;
      });
      clearTimeout(timer);
      return { status: res.status, headers, body };
    } catch (cause) {
      clearTimeout(timer);
      if (timeoutController.signal.aborted) {
        throw new PurelymailTransportError(`Request timed out after ${request.timeoutMs}ms`, {
          cause,
          timeout: true,
        });
      }
      if (request.signal?.aborted) {
        throw new PurelymailTransportError('Request was cancelled by the caller', {
          cause,
          timeout: false,
        });
      }
      throw new PurelymailTransportError('Network request failed', { cause });
    }
  }
}
