import { describe, expect, it } from 'vitest';
import { DEFAULT_BASE_URL, DEFAULT_TIMEOUT_MS, resolveConfig } from '../src/config.js';
import { EnvTokenProvider, StaticTokenProvider } from '../src/auth/token-provider.js';
import { PurelymailConfigError } from '../src/errors.js';
import { FakeTransport } from './helpers.js';

describe('resolveConfig', () => {
  it('applies secure defaults', () => {
    const cfg = resolveConfig({ token: 't' });
    expect(cfg.baseUrl).toBe(DEFAULT_BASE_URL);
    expect(cfg.timeoutMs).toBe(DEFAULT_TIMEOUT_MS);
    expect(cfg.userAgent).toContain('purelymail-core');
    expect(cfg.tokenProvider).toBeInstanceOf(StaticTokenProvider);
  });

  it('token-source precedence: provider > token > env', () => {
    const provider = new StaticTokenProvider('p');
    expect(resolveConfig({ tokenProvider: provider, token: 't' }).tokenProvider).toBe(provider);
    expect(resolveConfig({ token: 't' }).tokenProvider).toBeInstanceOf(StaticTokenProvider);
    expect(resolveConfig({}).tokenProvider).toBeInstanceOf(EnvTokenProvider);
  });

  it('enforces https and strips trailing slash', () => {
    expect(resolveConfig({ token: 't', baseUrl: 'https://example.com/' }).baseUrl).toBe(
      'https://example.com',
    );
    expect(() => resolveConfig({ token: 't', baseUrl: 'http://example.com' })).toThrow(
      PurelymailConfigError,
    );
    expect(() => resolveConfig({ token: 't', baseUrl: 'not a url' })).toThrow(
      PurelymailConfigError,
    );
  });

  it('rejects non-positive timeouts', () => {
    expect(() => resolveConfig({ token: 't', timeoutMs: 0 })).toThrow(PurelymailConfigError);
    expect(() => resolveConfig({ token: 't', timeoutMs: -5 })).toThrow(PurelymailConfigError);
    expect(() => resolveConfig({ token: 't', timeoutMs: Number.NaN })).toThrow(
      PurelymailConfigError,
    );
  });

  it('accepts an injected transport and custom overrides', () => {
    const transport = new FakeTransport(() => ({ status: 200, headers: {}, body: '{}' }));
    const cfg = resolveConfig({
      token: 't',
      transport,
      timeoutMs: 1234,
      userAgent: 'custom/1',
      retryPolicy: { maxRetries: 0, baseDelayMs: 1, maxDelayMs: 1 },
    });
    expect(cfg.transport).toBe(transport);
    expect(cfg.timeoutMs).toBe(1234);
    expect(cfg.userAgent).toBe('custom/1');
    expect(cfg.retryPolicy.maxRetries).toBe(0);
  });
});
