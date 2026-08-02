import { Readable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { CliContext } from '../src/context.js';
import { CliError } from '../src/output.js';
import { aggregate, emitAggregate, report, resolveSecret } from '../src/commands/shared.js';
import { capture, clientFactory, ok, apiError, registry } from './helpers.js';

describe('resolveSecret', () => {
  it('reads from a named env var', async () => {
    await expect(resolveSecret('password', false, 'VAR', { VAR: 'x' })).resolves.toBe('x');
  });
  it('rejects an empty env var', async () => {
    await expect(resolveSecret('password', false, 'VAR', { VAR: '' })).rejects.toBeInstanceOf(
      CliError,
    );
  });
  it('rejects when no source is given', async () => {
    await expect(resolveSecret('password', false, undefined, {})).rejects.toBeInstanceOf(CliError);
  });
  it('reads from stdin', async () => {
    const orig = Object.getOwnPropertyDescriptor(process, 'stdin')!;
    Object.defineProperty(process, 'stdin', {
      value: Readable.from(['piped-secret\n']),
      configurable: true,
    });
    try {
      await expect(resolveSecret('password', true, undefined)).resolves.toBe('piped-secret');
    } finally {
      Object.defineProperty(process, 'stdin', orig);
    }
  });
  it('rejects empty stdin', async () => {
    const orig = Object.getOwnPropertyDescriptor(process, 'stdin')!;
    Object.defineProperty(process, 'stdin', { value: Readable.from(['  \n']), configurable: true });
    try {
      await expect(resolveSecret('password', true, undefined)).rejects.toBeInstanceOf(CliError);
    } finally {
      Object.defineProperty(process, 'stdin', orig);
    }
  });
});

const reg = registry([['a', 'Org']]);

describe('report', () => {
  it('prints text or json based on ctx.json', () => {
    const t = capture();
    report(new CliContext({}, { registry: reg, io: t.io }), 'done');
    expect(t.out.join('')).toBe('done');
    const j = capture();
    report(new CliContext({ json: true }, { registry: reg, io: j.io }), 'done');
    expect(j.out.join('')).toContain('"ok": true');
  });
});

describe('aggregate + emitAggregate', () => {
  it('flattens successes and collects failures', async () => {
    const twoReg = registry([
      ['a', 'Org'],
      ['bad', 'Org'],
    ]);
    const ctx = new CliContext(
      { all: true },
      {
        registry: twoReg,
        io: capture().io,
        clientFactory: clientFactory((name) =>
          name === 'bad' ? apiError(500, 'X', 'down') : ok({ users: ['u@a.com'] }),
        ),
      },
    );
    const result = await aggregate(
      ctx,
      async (c) => (await c.users.list()).users,
      (u) => ({ userName: u }),
    );
    expect(result.rows).toHaveLength(1);
    expect(result.failures).toHaveLength(1);

    const j = capture();
    emitAggregate(j.io, true, ['profile', 'userName'], result);
    expect(j.out.join('')).toContain('"userName": "u@a.com"');
    expect(j.errs.join('')).toContain('bad');
  });
});
