import { Readable } from 'node:stream';
import { afterEach, describe, expect, it } from 'vitest';
import type { HttpResponse } from '@fablabfortsmith/purelymail-core';
import { run } from '../src/program.js';
import { capture, clientFactory, ok, registry } from './helpers.js';

const reg = registry([['acme', 'Org']]);

function respond(_name: string, path: string): HttpResponse {
  if (path === 'checkAccountCredit') {
    return ok({ credit: '$1.00' });
  }
  if (path === 'createAppPassword') {
    return ok({ appPassword: 'app-secret-xyz' });
  }
  return ok({});
}

async function cli(args: string[]): Promise<{ code: number; out: string; err: string }> {
  const cap = capture();
  const code = await run(args, {
    registry: reg,
    clientFactory: clientFactory(respond),
    io: cap.io,
  });
  return { code, out: cap.out.join('\n'), err: cap.errs.join('\n') };
}

async function withStdin<T>(value: string, fn: () => Promise<T>): Promise<T> {
  const orig = Object.getOwnPropertyDescriptor(process, 'stdin')!;
  Object.defineProperty(process, 'stdin', {
    value: Readable.from([`${value}\n`]),
    configurable: true,
  });
  try {
    return await fn();
  } finally {
    Object.defineProperty(process, 'stdin', orig);
  }
}

afterEach(() => {
  delete process.env.PM;
});

describe('domains flag branches', () => {
  it('handles deny/disable/recheck and enable variants', async () => {
    expect(
      (
        await cli([
          'domains',
          'update',
          'x.com',
          '-p',
          'acme',
          '--deny-account-reset',
          '--disable-subaddressing',
          '--recheck-dns',
        ])
      ).code,
    ).toBe(0);
    expect(
      (await cli(['domains', 'update', 'x.com', '-p', 'acme', '--enable-subaddressing'])).code,
    ).toBe(0);
  });

  it('supports json output on a mutation', async () => {
    const r = await cli(['domains', 'add', 'x.com', '-p', 'acme', '--json']);
    expect(r.out).toContain('"ok": true');
  });
});

describe('users flag branches', () => {
  it('create with recovery + negation flags via env password', async () => {
    process.env.PM = 'pw123456';
    const r = await cli([
      'users',
      'create',
      'admin',
      'acme.com',
      '-p',
      'acme',
      '--password-env',
      'PM',
      '--recovery-email',
      'r@x.com',
      '--recovery-email-description',
      'primary',
      '--recovery-phone',
      '5551234',
      '--recovery-phone-description',
      'cell',
      '--no-welcome-email',
      '--no-search-indexing',
      '--no-password-reset',
    ]);
    expect(r.code).toBe(0);
  });

  it('create with password from stdin', async () => {
    const r = await withStdin('stdin-pw', () =>
      cli(['users', 'create', 'admin', 'acme.com', '-p', 'acme', '--password-stdin']),
    );
    expect(r.code).toBe(0);
  });

  it('modify with rename, toggles and new password', async () => {
    process.env.PM = 'pw123456';
    expect(
      (
        await cli([
          'users',
          'modify',
          'a@acme.com',
          '-p',
          'acme',
          '--new-name',
          'b@acme.com',
          '--disable-search-indexing',
          '--enable-password-reset',
          '--require-2fa',
          '--password-env',
          'PM',
        ])
      ).code,
    ).toBe(0);
    expect(
      (
        await cli([
          'users',
          'modify',
          'a@acme.com',
          '-p',
          'acme',
          '--disable-2fa',
          '--disable-password-reset',
        ])
      ).code,
    ).toBe(0);
  });
});

describe('password-reset + app-password + routing flag branches', () => {
  it('upsert with existing-target/description/no-mfa and delete with target', async () => {
    expect(
      (
        await cli([
          'password-reset',
          'upsert',
          'a@acme.com',
          '-p',
          'acme',
          '--type',
          'phone',
          '--target',
          '5551234',
          '--existing-target',
          'old',
          '--description',
          'cell',
          '--no-mfa-reset',
        ])
      ).code,
    ).toBe(0);
    expect(
      (
        await cli([
          'password-reset',
          'delete',
          'a@acme.com',
          '-p',
          'acme',
          '--target',
          'r@x.com',
          '--yes',
        ])
      ).code,
    ).toBe(0);
  });

  it('app-password create --name --json and delete via stdin', async () => {
    const c = await cli([
      'app-password',
      'create',
      'a@acme.com',
      '-p',
      'acme',
      '--name',
      'laptop',
      '--json',
    ]);
    expect(c.out).toContain('appPassword');
    const d = await withStdin('the-app-pw', () =>
      cli(['app-password', 'delete', 'a@acme.com', '-p', 'acme', '--app-password-stdin', '--yes']),
    );
    expect(d.code).toBe(0);
  });

  it('routing create with prefix/catchall/match-user and json', async () => {
    const r = await cli([
      'routing',
      'create',
      '-p',
      'acme',
      '--domain',
      'd.com',
      '--match-user',
      'sales',
      '--target',
      'a@d.com',
      '--prefix',
      '--catchall',
      '--json',
    ]);
    expect(r.code).toBe(0);
  });
});

describe('global option parsing', () => {
  it('accepts --timeout and --base-url', async () => {
    const r = await cli([
      'account',
      'credit',
      '-p',
      'acme',
      '--timeout',
      '5000',
      '--base-url',
      'https://x.example.com',
    ]);
    expect(r.code).toBe(0);
    expect(r.out).toContain('$1.00');
  });
});
