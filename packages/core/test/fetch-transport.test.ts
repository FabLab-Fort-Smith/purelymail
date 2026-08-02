import { afterEach, describe, expect, it } from 'vitest';
import { FetchTransport, type FetchLike } from '../src/http/fetch-transport.js';
import { PurelymailTransportError } from '../src/errors.js';
import type { HttpRequest } from '../src/http/transport.js';

function req(overrides: Partial<HttpRequest> = {}): HttpRequest {
  return {
    url: 'https://purelymail.com/api/v0/x',
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: '{}',
    timeoutMs: 50,
    ...overrides,
  };
}

const rejectOnAbort: FetchLike = (_url, init) =>
  new Promise((_resolve, reject) => {
    if (init.signal.aborted) {
      reject(new Error('aborted'));
      return;
    }
    init.signal.addEventListener('abort', () => reject(new Error('aborted')), { once: true });
  });

describe('FetchTransport', () => {
  afterEach(() => {
    // no-op; each test manages its own globals
  });

  it('sends and normalizes a successful response (headers lower-cased)', async () => {
    const okFetch: FetchLike = () =>
      Promise.resolve({
        status: 201,
        headers: {
          forEach(cb) {
            cb('application/json', 'Content-Type');
          },
        },
        text: () => Promise.resolve('{"ok":true}'),
      });
    const t = new FetchTransport({ fetch: okFetch });
    const res = await t.send(req());
    expect(res.status).toBe(201);
    expect(res.headers['content-type']).toBe('application/json');
    expect(res.body).toBe('{"ok":true}');
  });

  it('combines a caller signal with the timeout on the success path', async () => {
    const ac = new AbortController();
    const okFetch: FetchLike = (_url, init) =>
      Promise.resolve({
        status: 200,
        headers: {
          forEach(cb) {
            cb('ok', 'X-Test');
          },
        },
        // prove the combined signal was passed through
        text: () => Promise.resolve(init.signal ? '{}' : 'no-signal'),
      });
    const t = new FetchTransport({ fetch: okFetch });
    const res = await t.send(req({ signal: ac.signal, timeoutMs: 1000 }));
    expect(res.status).toBe(200);
    expect(res.body).toBe('{}');
  });

  it('maps a network error to a transport error', async () => {
    const t = new FetchTransport({ fetch: () => Promise.reject(new Error('ECONNRESET')) });
    await expect(t.send(req())).rejects.toMatchObject({
      name: 'PurelymailTransportError',
      timeout: false,
    });
  });

  it('aborts on timeout and flags it', async () => {
    const t = new FetchTransport({ fetch: rejectOnAbort });
    const err = await t.send(req({ timeoutMs: 5 })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PurelymailTransportError);
    expect((err as PurelymailTransportError).timeout).toBe(true);
  });

  it('reports caller cancellation distinctly', async () => {
    const ac = new AbortController();
    ac.abort();
    const t = new FetchTransport({ fetch: rejectOnAbort });
    const err = await t.send(req({ signal: ac.signal, timeoutMs: 1000 })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PurelymailTransportError);
    expect((err as PurelymailTransportError).timeout).toBe(false);
    expect((err as Error).message).toContain('cancelled');
  });

  it('reports a network error even when a (non-aborted) signal is supplied', async () => {
    const ac = new AbortController();
    const t = new FetchTransport({ fetch: () => Promise.reject(new Error('ECONNREFUSED')) });
    const err = await t.send(req({ signal: ac.signal, timeoutMs: 1000 })).catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PurelymailTransportError);
    expect((err as PurelymailTransportError).timeout).toBe(false);
    expect((err as Error).message).toContain('Network request failed');
  });

  it('throws when no fetch is available', () => {
    const original = globalThis.fetch;
    // @ts-expect-error deliberately remove for the test
    delete globalThis.fetch;
    try {
      expect(() => new FetchTransport()).toThrow(PurelymailTransportError);
    } finally {
      globalThis.fetch = original;
    }
  });
});
