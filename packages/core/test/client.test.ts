import { describe, expect, it } from 'vitest';
import { PurelymailClient } from '../src/client.js';
import {
  PurelymailApiError,
  PurelymailAuthError,
  PurelymailTransportError,
  PurelymailValidationError,
} from '../src/errors.js';
import type { HttpResponse } from '../src/http/transport.js';
import type { RetryPolicy } from '../src/retry.js';
import { FakeTransport, jsonResponse, success } from './helpers.js';

const FAST_RETRY: RetryPolicy = { maxRetries: 2, baseDelayMs: 1, maxDelayMs: 2 };

function makeClient(
  handler: (req: unknown, i: number) => HttpResponse | Promise<HttpResponse>,
  token = 'tok_SECRET_123456',
): { client: PurelymailClient; transport: FakeTransport } {
  const transport = new FakeTransport(handler);
  const client = new PurelymailClient({
    token,
    transport,
    retryPolicy: FAST_RETRY,
    logger: { log: () => undefined },
  });
  return { client, transport };
}

describe('PurelymailClient success envelopes', () => {
  it('unwraps { type: "success", result }', async () => {
    const { client } = makeClient(() => success(200, { credit: '$1.00' }));
    await expect(client.account.credit()).resolves.toEqual({ credit: '$1.00' });
  });

  it('unwraps a bare { result } (no type)', async () => {
    const { client } = makeClient(() => jsonResponse(200, { result: { credit: '$2.00' } }));
    await expect(client.account.credit()).resolves.toEqual({ credit: '$2.00' });
  });

  it('treats an empty 2xx body as an empty result', async () => {
    const { client } = makeClient(() => ({ status: 200, headers: {}, body: '' }));
    await expect(
      client.users.create({ userName: 'a', domainName: 'd.com', password: 'p' }),
    ).resolves.toEqual({});
  });

  it('treats { type: "success" } with no result as empty', async () => {
    const { client } = makeClient(() => jsonResponse(200, { type: 'success' }));
    await expect(client.domains.delete({ name: 'd.com' })).resolves.toEqual({});
  });

  it('sends the correct header, path and body', async () => {
    const { client, transport } = makeClient(() => success(200, { credit: '$0' }));
    await client.account.credit();
    const sent = transport.requests[0]!;
    expect(sent.url).toBe('https://purelymail.com/api/v0/checkAccountCredit');
    expect(sent.headers['Purelymail-Api-Token']).toBe('tok_SECRET_123456');
    expect(sent.headers['Content-Type']).toBe('application/json');
    expect(sent.method).toBe('POST');
  });
});

describe('PurelymailClient error mapping', () => {
  it('maps { type: "error" } on a 200 to an ApiError', async () => {
    const { client } = makeClient(() =>
      jsonResponse(200, { type: 'error', code: 'NOPE', message: 'no' }),
    );
    await expect(client.account.credit()).rejects.toMatchObject({
      name: 'PurelymailApiError',
      code: 'NOPE',
    });
  });

  it('maps a 2xx body with code/message and no result to an ApiError', async () => {
    const { client } = makeClient(() => jsonResponse(200, { code: 'X', message: 'boom' }));
    await expect(client.account.credit()).rejects.toBeInstanceOf(PurelymailApiError);
  });

  it('maps a non-2xx error envelope with code + status', async () => {
    const { client } = makeClient(() =>
      jsonResponse(400, { type: 'error', code: 'BAD_REQUEST', message: 'bad' }),
    );
    const err = await client.account.credit().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PurelymailApiError);
    expect((err as PurelymailApiError).httpStatus).toBe(400);
    expect((err as PurelymailApiError).code).toBe('BAD_REQUEST');
  });

  it('maps 401/403 to an AuthError', async () => {
    const { client } = makeClient(() => jsonResponse(401, { message: 'nope' }));
    await expect(client.account.credit()).rejects.toBeInstanceOf(PurelymailAuthError);
  });

  it('maps an auth-like code to an AuthError even at 400', async () => {
    const { client } = makeClient(() =>
      jsonResponse(400, { code: 'INVALID_TOKEN', message: 'bad token' }),
    );
    await expect(client.account.credit()).rejects.toBeInstanceOf(PurelymailAuthError);
  });

  it('handles a non-JSON error body', async () => {
    const { client } = makeClient(() => ({ status: 500, headers: {}, body: 'gateway down' }));
    const err = await client.account.credit().catch((e: unknown) => e);
    expect((err as PurelymailApiError).httpStatus).toBe(500);
    expect((err as Error).message).toContain('HTTP 500');
  });

  it('redacts the token from error messages', async () => {
    const { client } = makeClient(() =>
      jsonResponse(400, { code: 'BAD', message: 'leaked tok_SECRET_123456 here' }),
    );
    const err = await client.account.credit().catch((e: unknown) => e);
    expect((err as Error).message).not.toContain('tok_SECRET_123456');
    expect((err as Error).message).toContain('«redacted»');
  });

  it('rejects a non-JSON 2xx body as a transport error', async () => {
    const { client } = makeClient(() => ({ status: 200, headers: {}, body: 'not json' }));
    await expect(client.account.credit()).rejects.toBeInstanceOf(PurelymailTransportError);
  });
});

describe('PurelymailClient validation', () => {
  it('rejects invalid input before any request', async () => {
    const { client, transport } = makeClient(() => success(200, {}));
    await expect(
      client.users.create({ userName: '', domainName: 'nope', password: '' }),
    ).rejects.toBeInstanceOf(PurelymailValidationError);
    expect(transport.requests).toHaveLength(0);
  });

  it('rejects a malformed response result', async () => {
    const { client } = makeClient(() => success(200, { credit: 123 }));
    const err = await client.account.credit().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(PurelymailValidationError);
    expect((err as PurelymailValidationError).phase).toBe('response');
  });

  it('flags a 2xx body missing the result field', async () => {
    const { client } = makeClient(() => jsonResponse(200, { foo: 1 }));
    await expect(client.account.credit()).rejects.toBeInstanceOf(PurelymailValidationError);
  });
});

describe('PurelymailClient retry', () => {
  it('retries a safe op on 429 then succeeds', async () => {
    let calls = 0;
    const { client, transport } = makeClient(() => {
      calls += 1;
      return calls === 1 ? jsonResponse(429, { message: 'slow' }) : success(200, { credit: '$1' });
    });
    await expect(client.account.credit()).resolves.toEqual({ credit: '$1' });
    expect(transport.requests).toHaveLength(2);
  });

  it('retries a safe op on a transport error then succeeds', async () => {
    let calls = 0;
    const { client } = makeClient(() => {
      calls += 1;
      if (calls === 1) {
        throw new PurelymailTransportError('flaky');
      }
      return success(200, { credit: '$1' });
    });
    await expect(client.account.credit()).resolves.toEqual({ credit: '$1' });
  });

  it('exhausts retries and throws', async () => {
    const { client, transport } = makeClient(() => jsonResponse(503, { message: 'down' }));
    await expect(client.account.credit()).rejects.toBeInstanceOf(PurelymailApiError);
    expect(transport.requests).toHaveLength(3); // initial + 2 retries
  });

  it('does NOT retry a mutating op by default', async () => {
    const { client, transport } = makeClient(() => jsonResponse(503, { message: 'down' }));
    await expect(client.domains.delete({ name: 'd.com' })).rejects.toBeInstanceOf(
      PurelymailApiError,
    );
    expect(transport.requests).toHaveLength(1);
  });

  it('respects per-call retry override (disable on safe op)', async () => {
    const { client, transport } = makeClient(() => jsonResponse(429, { message: 'slow' }));
    await expect(client.account.credit({ retry: false })).rejects.toBeInstanceOf(
      PurelymailApiError,
    );
    expect(transport.requests).toHaveLength(1);
  });

  it('respects per-call retry override (enable on mutating op)', async () => {
    let calls = 0;
    const { client, transport } = makeClient(() => {
      calls += 1;
      return calls === 1 ? jsonResponse(503, { message: 'x' }) : success(200, {});
    });
    await expect(client.domains.delete({ name: 'd.com' }, { retry: true })).resolves.toEqual({});
    expect(transport.requests).toHaveLength(2);
  });

  it('honours Retry-After header', async () => {
    let calls = 0;
    const { client } = makeClient(() => {
      calls += 1;
      return calls === 1
        ? jsonResponse(429, { message: 'slow' }, { 'retry-after': '0' })
        : success(200, { credit: '$1' });
    });
    await expect(client.account.credit()).resolves.toEqual({ credit: '$1' });
  });

  it('aborts during retry backoff when the signal fires', async () => {
    const ac = new AbortController();
    const bigDelay: RetryPolicy = { maxRetries: 2, baseDelayMs: 10_000, maxDelayMs: 10_000 };
    const transport = new FakeTransport(() => {
      ac.abort();
      return jsonResponse(429, { message: 'slow' });
    });
    const client = new PurelymailClient({ token: 't123456', transport, retryPolicy: bigDelay });
    await expect(client.account.credit({ signal: ac.signal })).rejects.toMatchObject({
      name: 'PurelymailTransportError',
    });
  });
});

describe('PurelymailClient per-call options + escape hatch', () => {
  it('passes signal and timeout overrides through to the transport', async () => {
    const ac = new AbortController();
    const { client, transport } = makeClient(() => success(200, { credit: '$0' }));
    await client.account.credit({ signal: ac.signal, timeoutMs: 999 });
    const sent = transport.requests[0]!;
    expect(sent.timeoutMs).toBe(999);
    expect(sent.signal).toBe(ac.signal);
  });

  it('exposes a low-level request() for arbitrary operations', async () => {
    const { client } = makeClient(() => success(200, { credit: '$9' }));
    const spec = {
      path: 'checkAccountCredit',
      requestSchema: (await import('../src/schemas.js')).emptyRequestSchema,
      resultSchema: (await import('../src/schemas.js')).checkCreditResultSchema,
      safe: true,
    };
    await expect(client.request(spec, {})).resolves.toEqual({ credit: '$9' });
  });
});
