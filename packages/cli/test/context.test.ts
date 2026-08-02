import { mkdtempSync, chmodSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PurelymailClient } from '@fablabfortsmith/purelymail-core';
import { CliContext } from '../src/context.js';
import { CliError } from '../src/output.js';
import { capture, clientFactory, profile, registry, ok } from './helpers.js';

const reg = registry([['acme', 'Org'], ['other', 'Org'], ['solo']]);

describe('CliContext selection', () => {
  it('selects all / org / profile / default', () => {
    expect(new CliContext({ all: true }, { registry: reg }).selectedProfiles()).toHaveLength(3);
    expect(new CliContext({ org: 'Org' }, { registry: reg }).selectedProfiles()).toHaveLength(2);
    expect(new CliContext({ profile: 'solo' }, { registry: reg }).selectedProfiles()).toHaveLength(
      1,
    );
    expect(
      new CliContext({}, { registry: reg, defaultProfile: 'acme' }).selectedProfiles(),
    ).toHaveLength(1);
  });

  it('fails closed with no selection and no default', () => {
    expect(() => new CliContext({}, { registry: reg }).selectedProfiles()).toThrow(CliError);
  });

  it('singleProfile requires exactly one', () => {
    expect(new CliContext({ profile: 'acme' }, { registry: reg }).singleProfile().name).toBe(
      'acme',
    );
    expect(() => new CliContext({ all: true }, { registry: reg }).singleProfile()).toThrow(
      CliError,
    );
  });
});

describe('CliContext client building', () => {
  it('uses an injected client factory', () => {
    const factory = clientFactory(() => ok({}));
    const ctx = new CliContext({ profile: 'acme' }, { registry: reg, clientFactory: factory });
    expect(ctx.singleClient()).toBeInstanceOf(PurelymailClient);
  });

  it('builds a default client honouring base URL and timeout', () => {
    const ctx = new CliContext(
      { profile: 'acme', baseUrl: 'https://mock.example.com', timeoutMs: 1000 },
      { registry: reg },
    );
    expect(ctx.clientFor(profile('acme', 'Org'))).toBeInstanceOf(PurelymailClient);
  });

  it('builds a default client with no base URL / timeout overrides', () => {
    const ctx = new CliContext({ profile: 'solo' }, { registry: reg });
    expect(ctx.clientFor(profile('solo'))).toBeInstanceOf(PurelymailClient);
  });

  it('exposes a workspace over the selected accounts', async () => {
    const factory = clientFactory((_n, path) =>
      path === 'checkAccountCredit' ? ok({ credit: '$1' }) : ok({}),
    );
    const ctx = new CliContext({ all: true }, { registry: reg, clientFactory: factory });
    const outcomes = await ctx.workspace().run(ctx.selectedProfiles(), (c) => c.account.credit());
    expect(outcomes).toHaveLength(3);
  });
});

describe('CliContext config loading', () => {
  it('loads from disk and surfaces warnings', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pm-ctx-'));
    const path = join(dir, 'config.toml');
    writeFileSync(path, ['[[profile]]', 'name = "p"'].join('\n'), 'utf8');
    chmodSync(path, 0o644);
    const cap = capture();
    const ctx = new CliContext({ config: path }, { io: cap.io, env: {} });
    expect(ctx.registry().require('p').name).toBe('p');
    expect(cap.errs.join(' ')).toMatch(/warning/);
  });

  it('loads from disk without an injected env map', () => {
    const dir = mkdtempSync(join(tmpdir(), 'pm-ctx2-'));
    const path = join(dir, 'config.toml');
    writeFileSync(path, ['[[profile]]', 'name = "q"'].join('\n'), 'utf8');
    const ctx = new CliContext({ config: path }, { io: capture().io });
    expect(ctx.registry().require('q').name).toBe('q');
  });
});
