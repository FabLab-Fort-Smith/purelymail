import { describe, expect, it, vi } from 'vitest';
import { ConsoleLogger, NoopLogger, createRedactor } from '../src/logging/logger.js';

describe('createRedactor', () => {
  it('masks each secret occurrence', () => {
    const redact = createRedactor(['sekret_token_value']);
    expect(redact('token=sekret_token_value end')).toBe('token=«redacted» end');
  });

  it('ignores empty/short secrets (identity)', () => {
    const redact = createRedactor(['', 'abc']);
    expect(redact('abc def')).toBe('abc def');
  });

  it('returns identity when no secrets', () => {
    const redact = createRedactor([]);
    expect(redact('anything')).toBe('anything');
  });
});

describe('NoopLogger', () => {
  it('does nothing', () => {
    expect(() => new NoopLogger().log('info', 'hi')).not.toThrow();
  });
});

describe('ConsoleLogger', () => {
  it('writes redacted JSON lines to a sink at/above min level', () => {
    const lines: string[] = [];
    const log = new ConsoleLogger({
      secrets: ['topsecretvalue'],
      level: 'info',
      sink: (l) => lines.push(l),
    });
    log.log('debug', 'suppressed');
    log.log('info', 'auth', { token: 'topsecretvalue', n: 1 });
    expect(lines).toHaveLength(1);
    const parsed = JSON.parse(lines[0]!);
    expect(parsed.message).toBe('auth');
    expect(parsed.n).toBe(1);
    expect(lines[0]).not.toContain('topsecretvalue');
    expect(lines[0]).toContain('«redacted»');
  });

  it('honours a lower min level', () => {
    const lines: string[] = [];
    const log = new ConsoleLogger({ level: 'debug', sink: (l) => lines.push(l) });
    log.log('debug', 'shown');
    expect(lines).toHaveLength(1);
  });

  it('defaults to console.error and info level', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => undefined);
    try {
      const log = new ConsoleLogger();
      log.log('debug', 'no');
      log.log('error', 'yes');
      expect(spy).toHaveBeenCalledTimes(1);
    } finally {
      spy.mockRestore();
    }
  });
});
