import { describe, expect, it } from 'vitest';
import { EnvTokenProvider, StaticTokenProvider } from '../src/auth/token-provider.js';
import { PurelymailConfigError } from '../src/errors.js';

describe('StaticTokenProvider', () => {
  it('returns the token and describes itself', async () => {
    const p = new StaticTokenProvider('tok_123');
    await expect(p.getToken()).resolves.toBe('tok_123');
    expect(p.describe()).toBe('static');
  });

  it('rejects empty tokens', () => {
    expect(() => new StaticTokenProvider('')).toThrow(PurelymailConfigError);
    expect(() => new StaticTokenProvider('   ')).toThrow(PurelymailConfigError);
    // @ts-expect-error runtime guard for non-string
    expect(() => new StaticTokenProvider(undefined)).toThrow(PurelymailConfigError);
  });
});

describe('EnvTokenProvider', () => {
  it('reads the default variable', async () => {
    const p = new EnvTokenProvider({ env: { PURELYMAIL_API_TOKEN: 'from_env' } });
    await expect(p.getToken()).resolves.toBe('from_env');
    expect(p.describe()).toBe('env:PURELYMAIL_API_TOKEN');
  });

  it('reads a custom variable', async () => {
    const p = new EnvTokenProvider({ varName: 'PM_ACME', env: { PM_ACME: 'acme' } });
    await expect(p.getToken()).resolves.toBe('acme');
    expect(p.describe()).toBe('env:PM_ACME');
  });

  it('throws when unset or empty (fail closed)', async () => {
    await expect(new EnvTokenProvider({ env: {} }).getToken()).rejects.toBeInstanceOf(
      PurelymailConfigError,
    );
    await expect(
      new EnvTokenProvider({ env: { PURELYMAIL_API_TOKEN: '  ' } }).getToken(),
    ).rejects.toBeInstanceOf(PurelymailConfigError);
  });

  it('defaults to process.env when no env is provided', async () => {
    const varName = 'PM_TEST_TOKEN_XYZ';
    process.env[varName] = 'live';
    try {
      const p = new EnvTokenProvider({ varName });
      await expect(p.getToken()).resolves.toBe('live');
    } finally {
      delete process.env[varName];
    }
  });
});
