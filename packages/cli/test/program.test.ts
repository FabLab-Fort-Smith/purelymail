import { afterEach, describe, expect, it } from 'vitest';
import type { HttpResponse, Profile } from '@fablabfortsmith/purelymail-core';
import { run } from '../src/program.js';
import { apiError, capture, clientFactory, ok, registry } from './helpers.js';

const baseReg = registry([
  ['acme', 'Org'],
  ['other', 'Org'],
]);

function respond(name: string, path: string): HttpResponse {
  if (name === 'bad') {
    return apiError(500, 'DOWN', 'account down');
  }
  switch (path) {
    case 'listDomains':
      return ok({
        domains: [
          {
            name: `${name}.com`,
            allowAccountReset: false,
            symbolicSubaddressing: false,
            isShared: false,
            dnsSummary: { passesMx: true, passesSpf: false, passesDkim: true, passesDmarc: false },
          },
        ],
      });
    case 'listUser':
      return ok({ users: [`admin@${name}.com`] });
    case 'getUser':
      return ok({
        enableSearchIndexing: true,
        recoveryEnabled: true,
        requireTwoFactorAuthentication: false,
        enableSpamFiltering: true,
        resetMethods: [],
      });
    case 'listRoutingRules':
      return ok({
        rules: [
          {
            id: 1,
            domainName: `${name}.com`,
            prefix: false,
            matchUser: 'sales',
            targetAddresses: [`a@${name}.com`],
            catchall: false,
          },
        ],
      });
    case 'listPasswordReset':
      return ok({
        users: [{ type: 'email', target: 'r@x.com', description: '', allowMfaReset: true }],
      });
    case 'createAppPassword':
      return ok({ appPassword: 'app-secret-xyz' });
    case 'checkAccountCredit':
      return ok({ credit: '$5.00' });
    case 'getOwnershipCode':
      return ok({ code: 'own-code' });
    default:
      return ok({});
  }
}

async function cli(
  args: string[],
  opts?: {
    reg?: typeof baseReg;
    factory?: (p: Profile) => unknown;
    def?: string;
    notify?: unknown;
    mailer?: unknown;
  },
): Promise<{ code: number; out: string; err: string }> {
  const cap = capture();
  const code = await run(args, {
    registry: opts?.reg ?? baseReg,
    clientFactory: (opts?.factory ?? clientFactory(respond)) as never,
    io: cap.io,
    ...(opts?.def ? { defaultProfile: opts.def } : {}),
    ...(opts?.notify ? { notify: opts.notify as never } : {}),
    ...(opts?.mailer ? { mailerFactory: opts.mailer as never } : {}),
  });
  return { code, out: cap.out.join('\n'), err: cap.errs.join('\n') };
}

afterEach(() => {
  delete process.env.PM_PW;
  delete process.env.PM_AP;
});

describe('profiles', () => {
  it('lists profiles and orgs', async () => {
    const list = await cli(['profiles', 'list']);
    expect(list.code).toBe(0);
    expect(list.out).toContain('acme');
    const orgs = await cli(['profiles', 'orgs', '--json']);
    expect(orgs.out).toContain('Org');
  });
});

describe('domains', () => {
  it('lists across all accounts (table + json)', async () => {
    const t = await cli(['domains', 'list', '--all']);
    expect(t.code).toBe(0);
    expect(t.out).toContain('acme.com');
    const j = await cli(['domains', 'list', '--all', '--json']);
    expect(j.out).toContain('"name": "acme.com"');
  });

  it('surfaces per-account failures without aborting', async () => {
    const reg = registry([
      ['acme', 'Org'],
      ['bad', 'Org'],
    ]);
    const r = await cli(['domains', 'list', '--all'], { reg });
    expect(r.code).toBe(0);
    expect(r.out).toContain('acme.com');
    expect(r.err).toContain('bad');
  });

  it('adds, shows ownership, updates, deletes', async () => {
    expect((await cli(['domains', 'add', 'x.com', '-p', 'acme'])).code).toBe(0);
    expect((await cli(['domains', 'ownership', '-p', 'acme'])).out).toContain('own-code');
    expect(
      (await cli(['domains', 'update', 'x.com', '-p', 'acme', '--allow-account-reset'])).code,
    ).toBe(0);
    expect((await cli(['domains', 'delete', 'x.com', '-p', 'acme', '--yes'])).code).toBe(0);
  });

  it('rejects conflicting update flags', async () => {
    const r = await cli([
      'domains',
      'update',
      'x.com',
      '-p',
      'acme',
      '--allow-account-reset',
      '--deny-account-reset',
    ]);
    expect(r.code).toBe(2);
  });

  it('refuses to delete without confirmation in a non-tty', async () => {
    const r = await cli(['domains', 'delete', 'x.com', '-p', 'acme']);
    expect(r.code).toBe(7);
  });
});

describe('users', () => {
  it('lists, gets, creates, modifies, deletes', async () => {
    expect((await cli(['users', 'list', '--all'])).out).toContain('admin@acme.com');
    expect((await cli(['users', 'get', 'a@acme.com', '-p', 'acme', '--json'])).out).toContain(
      'enableSearchIndexing',
    );
    process.env.PM_PW = 'sup3rsecret';
    expect(
      (await cli(['users', 'create', 'admin', 'acme.com', '-p', 'acme', '--password-env', 'PM_PW']))
        .code,
    ).toBe(0);
    expect(
      (await cli(['users', 'modify', 'a@acme.com', '-p', 'acme', '--enable-search-indexing'])).code,
    ).toBe(0);
    expect((await cli(['users', 'delete', 'a@acme.com', '-p', 'acme', '--yes'])).code).toBe(0);
  });

  it('requires a password source for create', async () => {
    const r = await cli(['users', 'create', 'admin', 'acme.com', '-p', 'acme']);
    expect(r.code).toBe(2);
  });

  it('generates and prints a password with --generate-password', async () => {
    const r = await cli([
      'users',
      'create',
      'admin',
      'acme.com',
      '-p',
      'acme',
      '--generate-password',
      '--password-length',
      '24',
    ]);
    expect(r.code).toBe(0);
    expect(r.out).toContain('Created user admin@acme.com');
    const match = r.out.match(/Generated password \(shown once[^)]*\): (\S+)/);
    expect(match?.[1]).toBeDefined();
    expect(match?.[1] ?? '').toHaveLength(24);
  });

  it('rejects a non-numeric --password-length', async () => {
    const r = await cli([
      'users',
      'create',
      'admin',
      'acme.com',
      '-p',
      'acme',
      '--generate-password',
      '--password-length',
      'abc',
    ]);
    expect(r.code).toBe(2);
  });

  const fakeNotify = {
    host: 'smtp.x',
    port: 465,
    secure: undefined,
    user: 'admin@d.com',
    from: undefined,
    passwordProvider: { getToken: async (): Promise<string> => 'smtp-pw', describe: () => 'env:X' },
  };

  it('--notify emails the account details to the recovery address', async () => {
    const sends: { to: string; subject: string; text: string }[] = [];
    const r = await cli(
      [
        'users',
        'create',
        'newbie',
        'acme.com',
        '-p',
        'acme',
        '--generate-password',
        '--recovery-email',
        'rec@x.com',
        '--notify',
        '--yes',
      ],
      {
        notify: fakeNotify,
        mailer: () => ({ send: async (m: (typeof sends)[0]) => void sends.push(m) }),
      },
    );
    expect(r.code).toBe(0);
    expect(r.out).toContain('Created user newbie@acme.com');
    expect(r.out).toContain('Sent account details to rec@x.com');
    expect(sends).toHaveLength(1);
    expect(sends[0]!.to).toBe('rec@x.com');
    const pw = r.out.match(/shown once[^)]*\): (\S+)/)?.[1] ?? '';
    expect(pw).not.toBe('');
    expect(sends[0]!.text).toContain(pw);
    expect(sends[0]!.text).toContain('newbie@acme.com');
  });

  it('--notify without --recovery-email fails before creating', async () => {
    const created: unknown[] = [];
    const r = await cli(
      ['users', 'create', 'x', 'acme.com', '-p', 'acme', '--generate-password', '--notify'],
      {
        notify: fakeNotify,
        factory: () => ({ users: { create: async (b: unknown) => void created.push(b) } }),
      },
    );
    expect(r.code).toBe(2);
    expect(created).toHaveLength(0);
  });

  it('--notify with a malformed --recovery-email fails before creating', async () => {
    const created: unknown[] = [];
    const r = await cli(
      [
        'users',
        'create',
        'x',
        'acme.com',
        '-p',
        'acme',
        '--generate-password',
        '--recovery-email',
        'not-an-email',
        '--notify',
      ],
      {
        notify: fakeNotify,
        factory: () => ({ users: { create: async (b: unknown) => void created.push(b) } }),
      },
    );
    expect(r.code).toBe(2);
    expect(created).toHaveLength(0);
  });

  it('--notify without a [notify] config section fails', async () => {
    const r = await cli(
      [
        'users',
        'create',
        'x',
        'acme.com',
        '-p',
        'acme',
        '--generate-password',
        '--recovery-email',
        'rec@x.com',
        '--notify',
      ],
      { mailer: () => ({ send: async () => undefined }) },
    );
    expect(r.code).toBe(2);
    expect(r.err).toContain('[notify]');
  });

  it('--notify send failure warns but the user is still created', async () => {
    const r = await cli(
      [
        'users',
        'create',
        'newbie',
        'acme.com',
        '-p',
        'acme',
        '--generate-password',
        '--recovery-email',
        'rec@x.com',
        '--notify',
        '--yes',
      ],
      {
        notify: fakeNotify,
        mailer: () => ({
          send: async () => {
            throw new Error('smtp down');
          },
        }),
      },
    );
    expect(r.code).toBe(0);
    expect(r.out).toContain('Created user newbie@acme.com');
    expect(r.err).toContain('welcome email failed');
    expect(r.err).toContain('smtp down');
  });
});

describe('routing', () => {
  it('lists, creates, deletes', async () => {
    expect((await cli(['routing', 'list', '--all'])).out).toContain('sales');
    expect(
      (
        await cli([
          'routing',
          'create',
          '-p',
          'acme',
          '--domain',
          'acme.com',
          '--target',
          'a@acme.com',
        ])
      ).code,
    ).toBe(0);
    expect((await cli(['routing', 'delete', '1', '-p', 'acme', '--yes'])).code).toBe(0);
  });

  it('requires a target and a valid id', async () => {
    expect((await cli(['routing', 'create', '-p', 'acme', '--domain', 'acme.com'])).code).toBe(2);
    expect((await cli(['routing', 'delete', 'abc', '-p', 'acme', '--yes'])).code).toBe(2);
  });
});

describe('password-reset', () => {
  it('lists, upserts, deletes', async () => {
    expect((await cli(['password-reset', 'list', 'a@acme.com', '-p', 'acme'])).out).toContain(
      'r@x.com',
    );
    expect(
      (
        await cli([
          'password-reset',
          'upsert',
          'a@acme.com',
          '-p',
          'acme',
          '--type',
          'email',
          '--target',
          'r@x.com',
        ])
      ).code,
    ).toBe(0);
    expect(
      (await cli(['password-reset', 'delete', 'a@acme.com', '-p', 'acme', '--yes'])).code,
    ).toBe(0);
  });

  it('rejects an invalid type', async () => {
    const r = await cli([
      'password-reset',
      'upsert',
      'a@acme.com',
      '-p',
      'acme',
      '--type',
      'sms',
      '--target',
      'r@x.com',
    ]);
    expect(r.code).toBe(2);
  });
});

describe('app-password', () => {
  it('creates (prints secret once) and deletes', async () => {
    const c = await cli(['app-password', 'create', 'a@acme.com', '-p', 'acme']);
    expect(c.out).toContain('app-secret-xyz');
    expect(c.err).toContain('shown once');
    process.env.PM_AP = 'the-app-pw';
    expect(
      (
        await cli([
          'app-password',
          'delete',
          'a@acme.com',
          '-p',
          'acme',
          '--app-password-env',
          'PM_AP',
          '--yes',
        ])
      ).code,
    ).toBe(0);
  });
});

describe('account + selection + errors', () => {
  it('aggregates credit', async () => {
    expect((await cli(['account', 'credit', '--all'])).out).toContain('$5.00');
  });

  it('fails closed when nothing is selected', async () => {
    expect((await cli(['account', 'credit'])).code).toBe(5);
  });

  it('rejects a multi-account selection for a single-account command', async () => {
    expect((await cli(['domains', 'add', 'x.com', '--all'])).code).toBe(2);
  });

  it('maps an auth failure to exit code 3', async () => {
    const factory = clientFactory(() => apiError(401, 'INVALID_TOKEN', 'bad token'));
    const r = await cli(['domains', 'add', 'x.com', '-p', 'acme'], { factory });
    expect(r.code).toBe(3);
    expect(r.err).toContain('PurelymailAuthError');
  });

  it('uses the default profile when set', async () => {
    const r = await cli(['account', 'credit'], { def: 'acme' });
    expect(r.code).toBe(0);
    expect(r.out).toContain('$5.00');
  });

  it('returns nonzero for an unknown command and zero for help', async () => {
    expect((await cli(['definitely-not-a-command'])).code).not.toBe(0);
    expect((await cli(['--help'])).code).toBe(0);
    expect((await cli(['--version'])).code).toBe(0);
  });
});
