import { Readable } from 'node:stream';
import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import {
  ProfileRegistry,
  StaticTokenProvider,
  type HttpResponse,
} from '@fablabfortsmith/purelymail-core';
import { run } from '../src/program.js';
import { loadProfiles } from '@fablabfortsmith/purelymail-config';
import { capture, clientFactory, ok, registry } from './helpers.js';

const reg = registry([['acme', 'Org']]);

function respond(_name: string, path: string): HttpResponse {
  if (path === 'checkAccountCredit') {
    return ok({ credit: '$1' });
  }
  return ok({});
}

async function cli(
  args: string[],
  regOverride?: ProfileRegistry,
): Promise<{ code: number; out: string; err: string }> {
  const cap = capture();
  const code = await run(args, {
    registry: regOverride ?? reg,
    clientFactory: clientFactory(respond),
    io: cap.io,
  });
  return { code, out: cap.out.join('\n'), err: cap.errs.join('\n') };
}

/** Run `fn` with process.stdin faking an interactive TTY answering `answer`. */
async function withTtyAnswer<T>(answer: string, fn: () => Promise<T>): Promise<T> {
  const orig = Object.getOwnPropertyDescriptor(process, 'stdin')!;
  const stream = Object.assign(Readable.from([`${answer}\n`]), { isTTY: true });
  Object.defineProperty(process, 'stdin', { value: stream, configurable: true });
  try {
    return await fn();
  } finally {
    Object.defineProperty(process, 'stdin', orig);
  }
}

afterEach(() => {
  delete process.env.PM_AP;
});

describe('declined confirmations abort cleanly', () => {
  it('domains delete', async () => {
    const r = await withTtyAnswer('n', () => cli(['domains', 'delete', 'x.com', '-p', 'acme']));
    expect(r.code).toBe(0);
    expect(r.err).toContain('aborted');
  });
  it('users delete', async () => {
    const r = await withTtyAnswer('n', () => cli(['users', 'delete', 'a@acme.com', '-p', 'acme']));
    expect(r.err).toContain('aborted');
  });
  it('routing delete', async () => {
    const r = await withTtyAnswer('n', () => cli(['routing', 'delete', '1', '-p', 'acme']));
    expect(r.err).toContain('aborted');
  });
  it('password-reset delete', async () => {
    const r = await withTtyAnswer('n', () =>
      cli(['password-reset', 'delete', 'a@acme.com', '-p', 'acme']),
    );
    expect(r.err).toContain('aborted');
  });
  it('app-password delete', async () => {
    process.env.PM_AP = 'pw';
    const r = await withTtyAnswer('n', () =>
      cli(['app-password', 'delete', 'a@acme.com', '-p', 'acme', '--app-password-env', 'PM_AP']),
    );
    expect(r.err).toContain('aborted');
  });
});

describe('profiles rendering variants', () => {
  const tp = new StaticTokenProvider('t-123456');
  const labeled = new ProfileRegistry([
    { name: 'acme', org: 'Org', label: 'Acme prod', tokenProvider: tp },
    { name: 'solo', tokenProvider: tp },
  ]);

  it('lists profiles with and without org/label (table)', async () => {
    const r = await cli(['profiles', 'list'], labeled);
    expect(r.out).toContain('Acme prod');
    expect(r.out).toContain('solo');
  });

  it('prints orgs as text', async () => {
    const r = await cli(['profiles', 'orgs'], labeled);
    expect(r.out).toContain('Org');
  });
});

describe('config-file tight permissions produce no warning', () => {
  it('does not warn on a 0600 file', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pm-perm-'));
    const path = join(dir, 'config.toml');
    writeFileSync(path, ['[[profile]]', 'name = "p"'].join('\n'), 'utf8');
    chmodSync(path, 0o600);
    const loaded = loadProfiles({ configPath: path, env: {} });
    expect(loaded.warnings).toHaveLength(0);
  });
});
