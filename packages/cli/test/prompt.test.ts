import { PassThrough, Writable } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { createPrompter, type PromptIO } from '../src/prompt.js';

function harness(lines: string[]): { io: PromptIO; out: () => string } {
  // Feed one answer each time a prompt (ending in ": ") is written, so readline
  // never batches multiple buffered lines and drop the ones without a listener.
  const answers = [...lines];
  const input = new PassThrough();
  const chunks: string[] = [];
  const output = new Writable({
    write(chunk, _enc, cb) {
      const s = chunk.toString();
      chunks.push(s);
      if (s.endsWith(': ')) {
        const next = answers.shift();
        if (next !== undefined) {
          setImmediate(() => input.write(`${next}\n`));
        }
      }
      cb();
    },
  });
  return { io: { input, output, isTty: false }, out: () => chunks.join('') };
}

describe('Prompter.ask', () => {
  it('returns the default on empty input', async () => {
    const h = harness(['']);
    const p = createPrompter(h.io);
    expect(await p.ask('Name', { default: 'd' })).toBe('d');
    p.close();
  });
  it('returns typed input', async () => {
    const h = harness(['bob']);
    const p = createPrompter(h.io);
    expect(await p.ask('Name')).toBe('bob');
    p.close();
  });
  it('loops until a required value is given', async () => {
    const h = harness(['', 'real']);
    const p = createPrompter(h.io);
    expect(await p.ask('Name', { required: true })).toBe('real');
    expect(h.out()).toContain('(required)');
    p.close();
  });
});

describe('Prompter.askSecret', () => {
  it('reads a secret and prints the prompt', async () => {
    const h = harness(['s3cret']);
    const p = createPrompter(h.io);
    expect(await p.askSecret('Token')).toBe('s3cret');
    expect(h.out()).toContain('Token');
    p.close();
  });
});

describe('Prompter.askYesNo', () => {
  it('handles yes / no / default', async () => {
    let p = createPrompter(harness(['y']).io);
    expect(await p.askYesNo('q')).toBe(true);
    p.close();
    p = createPrompter(harness(['n']).io);
    expect(await p.askYesNo('q')).toBe(false);
    p.close();
    p = createPrompter(harness(['']).io);
    expect(await p.askYesNo('q', true)).toBe(true);
    p.close();
  });
});

describe('Prompter.askChoice', () => {
  it('selects by number', async () => {
    const h = harness(['2']);
    const p = createPrompter(h.io);
    expect(
      await p.askChoice('pick', [
        { label: 'a', value: 'A' },
        { label: 'b', value: 'B' },
      ]),
    ).toBe('B');
    expect(h.out()).toContain('1) a');
    p.close();
  });
  it('uses the default on empty', async () => {
    const p = createPrompter(harness(['']).io);
    expect(await p.askChoice('pick', [{ label: 'a', value: 'A' }], 'A')).toBe('A');
    p.close();
  });
  it('re-prompts on an invalid choice', async () => {
    const h = harness(['9', '1']);
    const p = createPrompter(h.io);
    expect(await p.askChoice('pick', [{ label: 'a', value: 'A' }])).toBe('A');
    expect(h.out()).toContain('invalid choice');
    p.close();
  });
});
