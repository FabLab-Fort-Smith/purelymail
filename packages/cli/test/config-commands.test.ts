import { PassThrough, Readable, Writable } from 'node:stream';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { run } from '../src/program.js';
import { readConfigData, writeConfigData } from '../src/config-store.js';
import type { KeyringLoader } from '@fablabfortsmith/purelymail-config';
import { capture } from './helpers.js';

function scripted(lines: string[]): {
  input: PassThrough;
  output: Writable;
  prompts: () => string;
} {
  // Feed the next answer each time a prompt (ending in ": ") is written, so
  // readline doesn't batch buffered lines and drop those without a listener.
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
  return { input, output, prompts: () => chunks.join('') };
}

function fakeKeyring(): { loader: KeyringLoader; store: Record<string, string> } {
  const store: Record<string, string> = {};
  const loader: KeyringLoader = () =>
    Promise.resolve({
      Entry: class {
        #key: string;
        constructor(service: string, account: string) {
          this.#key = `${service}/${account}`;
        }
        getPassword(): string | null {
          return store[this.#key] ?? null;
        }
        setPassword(value: string): void {
          store[this.#key] = value;
        }
      },
    });
  return { loader, store };
}

function tmpConfig(): string {
  return join(mkdtempSync(join(tmpdir(), 'pm-wiz-')), 'config.toml');
}

async function cli(
  args: string[],
  lines: string[] = [],
  opts?: { keyring?: { loader: KeyringLoader } },
): Promise<{ code: number; out: string; err: string; prompts: string }> {
  const cap = capture();
  const s = scripted(lines);
  const code = await run(args, {
    io: cap.io,
    input: s.input,
    output: s.output,
    isTty: true, // simulate an interactive session (a human typing the answers)
    ...(opts?.keyring ? { keyringLoader: opts.keyring.loader } : {}),
    env: {},
  });
  return { code, out: cap.out.join('\n'), err: cap.errs.join('\n'), prompts: s.prompts() };
}

describe('init / profiles add (env source)', () => {
  it('creates a profile and prints an export hint (no secret on disk)', async () => {
    const cfg = tmpConfig();
    // name, org, baseUrl, label, source(default env), tokenEnv(default), make-default(default)
    const r = await cli(['--config', cfg, 'init'], ['acme', 'Acme', '', '', '', '', '']);
    expect(r.code).toBe(0);
    const data = readConfigData(cfg);
    expect(data.defaultProfile).toBe('acme');
    expect(data.profile).toEqual([
      { name: 'acme', org: 'Acme', tokenEnv: 'PURELYMAIL_TOKEN_ACME' },
    ]);
    expect(r.err).toContain('export PURELYMAIL_TOKEN_ACME');
    expect(r.err).not.toContain('token='); // no secret value printed
  });

  it('rejects a non-https base URL', async () => {
    const cfg = tmpConfig();
    const r = await cli(['--config', cfg, 'profiles', 'add'], ['x', '', 'http://insecure', '', '']);
    expect(r.code).toBe(2);
  });

  it('refuses to run non-interactively', async () => {
    const cfg = tmpConfig();
    const cap = capture();
    const s = scripted([]);
    const code = await run(['--config', cfg, 'init'], {
      io: cap.io,
      input: s.input,
      output: s.output,
      isTty: false,
      env: {},
    });
    expect(code).toBe(2);
    expect(cap.errs.join('\n')).toContain('interactive');
  });
});

describe('profiles add (keychain source)', () => {
  it('stores the token in the keychain and records metadata only', async () => {
    const cfg = tmpConfig();
    const keyring = fakeKeyring();
    // name, org, baseUrl, label, source=2(keychain), keychainAccount(default), secret, make-default
    const r = await cli(
      ['--config', cfg, 'profiles', 'add'],
      ['beta', 'Beta', '', '', '2', '', 'tok-beta', ''],
      { keyring },
    );
    expect(r.code).toBe(0);
    expect(keyring.store['purelymail/beta']).toBe('tok-beta');
    const entry = readConfigData(cfg).profile!.find((p) => p.name === 'beta');
    expect(entry).toEqual({ name: 'beta', org: 'Beta', keychain: true, keychainAccount: 'beta' });
  });

  it('aborts on an empty keychain token', async () => {
    const cfg = tmpConfig();
    const keyring = fakeKeyring();
    const r = await cli(['--config', cfg, 'profiles', 'add'], ['beta', '', '', '', '2', '', ''], {
      keyring,
    });
    expect(r.code).toBe(2);
  });
});

describe('profiles edit / remove / set-default', () => {
  it('edits an existing profile', async () => {
    const cfg = tmpConfig();
    writeConfigData(cfg, {
      defaultProfile: 'acme',
      profile: [{ name: 'acme', org: 'Acme', tokenEnv: 'PURELYMAIL_TOKEN_ACME' }],
    });
    // org, baseUrl, label, source(env), tokenEnv (acme is default -> no make-default prompt)
    const r = await cli(
      ['--config', cfg, 'profiles', 'edit', 'acme'],
      ['AcmeEdited', '', '', '', 'PURELYMAIL_TOKEN_ACME2'],
    );
    expect(r.code).toBe(0);
    const entry = readConfigData(cfg).profile!.find((p) => p.name === 'acme');
    expect(entry).toMatchObject({ org: 'AcmeEdited', tokenEnv: 'PURELYMAIL_TOKEN_ACME2' });
  });

  it('rejects editing an unknown profile', async () => {
    const cfg = tmpConfig();
    const r = await cli(['--config', cfg, 'profiles', 'edit', 'ghost'], []);
    expect(r.code).toBe(2);
  });

  it('removes a profile with --yes', async () => {
    const cfg = tmpConfig();
    writeConfigData(cfg, {
      defaultProfile: 'a',
      profile: [
        { name: 'a', tokenEnv: 'A' },
        { name: 'b', tokenEnv: 'B' },
      ],
    });
    const r = await cli(['--config', cfg, 'profiles', 'remove', 'a', '--yes']);
    expect(r.code).toBe(0);
    const data = readConfigData(cfg);
    expect(data.profile!.map((p) => p.name)).toEqual(['b']);
    expect(data.defaultProfile).toBeUndefined();
  });

  it('refuses to remove without confirmation in a non-tty', async () => {
    const cfg = tmpConfig();
    writeConfigData(cfg, { profile: [{ name: 'a', tokenEnv: 'A' }] });
    const r = await cli(['--config', cfg, 'profiles', 'remove', 'a']);
    expect(r.code).toBe(7);
  });

  it('sets the default profile', async () => {
    const cfg = tmpConfig();
    writeConfigData(cfg, {
      profile: [
        { name: 'a', tokenEnv: 'A' },
        { name: 'b', tokenEnv: 'B' },
      ],
    });
    const r = await cli(['--config', cfg, 'profiles', 'set-default', 'b']);
    expect(r.code).toBe(0);
    expect(readConfigData(cfg).defaultProfile).toBe('b');
  });
});

/** Run `fn` with process.stdin faking an interactive TTY answering `answer`. */
async function withTty<T>(answer: string, fn: () => Promise<T>): Promise<T> {
  const orig = Object.getOwnPropertyDescriptor(process, 'stdin')!;
  const stream = Object.assign(Readable.from([`${answer}\n`]), { isTTY: true });
  Object.defineProperty(process, 'stdin', { value: stream, configurable: true });
  try {
    return await fn();
  } finally {
    Object.defineProperty(process, 'stdin', orig);
  }
}

describe('additional coverage', () => {
  it('init notes an existing config and adds another profile', async () => {
    const cfg = tmpConfig();
    writeConfigData(cfg, { defaultProfile: 'one', profile: [{ name: 'one', tokenEnv: 'ONE' }] });
    const r = await cli(['--config', cfg, 'init'], ['two', '', '', '', '', '', '']);
    expect(r.code).toBe(0);
    expect(r.prompts).toContain('already has');
    expect(readConfigData(cfg).profile!.map((p) => p.name)).toEqual(['one', 'two']);
  });

  it('lists profiles as JSON', async () => {
    const cfg = tmpConfig();
    writeConfigData(cfg, { profile: [{ name: 'a', org: 'Org', tokenEnv: 'A' }] });
    const r = await cli(['--config', cfg, 'profiles', 'list', '--json']);
    expect(r.code).toBe(0);
    expect(r.out).toContain('"name": "a"');
  });

  it('records org, baseUrl and label when provided (env source)', async () => {
    const cfg = tmpConfig();
    // name, org, baseUrl(https), label, source(env), tokenEnv(default), make-default(default yes)
    const r = await cli(
      ['--config', cfg, 'profiles', 'add'],
      ['acme', 'Acme', 'https://mail.example.com', 'Prod', '', '', ''],
    );
    expect(r.code).toBe(0);
    expect(readConfigData(cfg).profile![0]).toEqual({
      name: 'acme',
      org: 'Acme',
      baseUrl: 'https://mail.example.com',
      label: 'Prod',
      tokenEnv: 'PURELYMAIL_TOKEN_ACME',
    });
    expect(readConfigData(cfg).defaultProfile).toBe('acme');
  });

  it('edits a keychain profile and re-stores the token', async () => {
    const cfg = tmpConfig();
    writeConfigData(cfg, {
      profile: [{ name: 'kc', keychain: true, keychainAccount: 'kc' }],
    });
    const keyring = fakeKeyring();
    // org, baseUrl, label, source(default keychain), keychainAccount(default), secret, make-default
    const r = await cli(
      ['--config', cfg, 'profiles', 'edit', 'kc'],
      ['', '', '', '', '', 'new-tok', ''],
      { keyring },
    );
    expect(r.code).toBe(0);
    expect(keyring.store['purelymail/kc']).toBe('new-tok');
    expect(readConfigData(cfg).profile![0]).toMatchObject({
      keychain: true,
      keychainAccount: 'kc',
    });
  });

  it('aborts a declined removal', async () => {
    const cfg = tmpConfig();
    writeConfigData(cfg, { profile: [{ name: 'a', tokenEnv: 'A' }] });
    const r = await withTty('n', () => cli(['--config', cfg, 'profiles', 'remove', 'a']));
    expect(r.code).toBe(0);
    expect(r.err).toContain('aborted');
    expect(readConfigData(cfg).profile).toHaveLength(1);
  });
});
