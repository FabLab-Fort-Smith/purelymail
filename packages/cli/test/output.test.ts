import { Readable } from 'node:stream';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import {
  PurelymailApiError,
  PurelymailAuthError,
  PurelymailConfigError,
  PurelymailTransportError,
  PurelymailValidationError,
} from '@fablabfortsmith/purelymail-core';
import { vi } from 'vitest';
import {
  CliError,
  confirm,
  exitCodeFor,
  messageFor,
  printRecord,
  printTable,
  readStdin,
  render,
  stdio,
} from '../src/output.js';
import { capture } from './helpers.js';

describe('stdio', () => {
  it('writes lines to the real process streams', () => {
    const out = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const err = vi.spyOn(process.stderr, 'write').mockImplementation(() => true);
    try {
      stdio.out('hello');
      stdio.err('oops');
      expect(out).toHaveBeenCalledWith('hello\n');
      expect(err).toHaveBeenCalledWith('oops\n');
    } finally {
      out.mockRestore();
      err.mockRestore();
    }
  });
});

describe('printTable', () => {
  it('prints aligned rows and stringifies objects', () => {
    const { io, out } = capture();
    printTable(io, [{ a: 1, b: { x: 2 } }], ['a', 'b']);
    expect(out[0]).toContain('a');
    expect(out.at(-1)).toContain('{"x":2}');
  });

  it('reports empty result on stderr', () => {
    const { io, errs } = capture();
    printTable(io, [], ['a']);
    expect(errs[0]).toContain('no results');
  });
});

describe('printRecord + render', () => {
  it('prints key/value lines', () => {
    const { io, out } = capture();
    printRecord(io, { credit: '$1', ok: true });
    expect(out.join('\n')).toContain('credit');
  });
  it('render switches on json flag', () => {
    const j = capture();
    render(j.io, true, { a: 1 }, () => j.io.err('table'));
    expect(j.out.join('')).toContain('"a": 1');
    const t = capture();
    render(t.io, false, { a: 1 }, (io) => io.out('table!'));
    expect(t.out.join('')).toBe('table!');
  });
});

describe('exitCodeFor + messageFor', () => {
  it('maps error types to exit codes', () => {
    expect(exitCodeFor(new CliError('x', 7))).toBe(7);
    expect(exitCodeFor(new PurelymailValidationError('request', ['x']))).toBe(2);
    expect(exitCodeFor(new PurelymailAuthError('x'))).toBe(3);
    expect(exitCodeFor(new PurelymailApiError('x'))).toBe(4);
    expect(exitCodeFor(new PurelymailConfigError('x'))).toBe(5);
    expect(exitCodeFor(new PurelymailTransportError('x'))).toBe(6);
    expect(exitCodeFor(new Error('x'))).toBe(1);
  });
  it('formats messages', () => {
    expect(messageFor(new CliError('boom'))).toContain('boom');
    expect(messageFor(new PurelymailApiError('nope'))).toContain('PurelymailApiError');
    expect(messageFor(new Error('plain'))).toBe('plain');
    expect(messageFor('weird')).toBe('weird');
  });
});

describe('confirm', () => {
  it('short-circuits when assumeYes', async () => {
    await expect(confirm('go?', true)).resolves.toBe(true);
  });
  it('throws in a non-interactive shell', async () => {
    await expect(confirm('go?', false, { isTty: false })).rejects.toBeInstanceOf(CliError);
  });
  it('reads a yes answer from the tty', async () => {
    const input = Readable.from(['y\n']);
    const output = new PassThrough();
    await expect(confirm('go?', false, { isTty: true, input, output })).resolves.toBe(true);
  });
  it('reads a no answer from the tty', async () => {
    const input = Readable.from(['n\n']);
    const output = new PassThrough();
    await expect(confirm('go?', false, { isTty: true, input, output })).resolves.toBe(false);
  });
});

describe('readStdin', () => {
  it('reads and trims all input', async () => {
    await expect(readStdin(Readable.from(['  secret \n']))).resolves.toBe('secret');
  });
});
