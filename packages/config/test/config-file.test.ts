import { chmodSync, mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { PurelymailConfigError } from '@fablabfortsmith/purelymail-core';
import { loadProfiles, resolveConfigPath } from '../src/config-file.js';

const tmp = mkdtempSync(join(tmpdir(), 'pm-cfg-'));
afterAll(() => {
  /* leave temp dir for the OS to clean */
});

function writeConfig(name: string, content: string): string {
  const path = join(tmp, name);
  writeFileSync(path, content, 'utf8');
  return path;
}

describe('resolveConfigPath', () => {
  it('prefers an explicit path, then env, then XDG', () => {
    expect(resolveConfigPath('/x/y.toml', {})).toBe('/x/y.toml');
    expect(resolveConfigPath(undefined, { PURELYMAIL_CONFIG_FILE: '/from/env.toml' })).toBe(
      '/from/env.toml',
    );
    expect(resolveConfigPath(undefined, { XDG_CONFIG_HOME: '/cfg' })).toBe(
      '/cfg/purelymail/config.toml',
    );
  });
});

describe('loadProfiles', () => {
  it('falls back to a single default profile when no file exists', () => {
    const loaded = loadProfiles({ env: { XDG_CONFIG_HOME: join(tmp, 'empty') } });
    expect(loaded.source).toBe('defaults');
    expect(loaded.defaultProfile).toBe('default');
    expect(loaded.registry.list()).toHaveLength(1);
    expect(loaded.registry.list()[0]!.tokenProvider.describe()).toBe('env:PURELYMAIL_API_TOKEN');
  });

  it('throws when an explicit config path is missing', () => {
    expect(() => loadProfiles({ configPath: join(tmp, 'nope.toml') })).toThrow(
      PurelymailConfigError,
    );
  });

  it('loads profiles with env and keychain token sources', () => {
    const path = writeConfig(
      'ok.toml',
      [
        'defaultProfile = "acme"',
        '',
        '[[profile]]',
        'name = "acme"',
        'org = "Acme"',
        'tokenEnv = "PM_ACME"',
        'baseUrl = "https://purelymail.com"',
        'label = "Acme prod"',
        '',
        '[[profile]]',
        'name = "client"',
        'org = "Beta"',
        'keychain = true',
        'keychainAccount = "beta-key"',
      ].join('\n'),
    );
    const loaded = loadProfiles({ configPath: path, env: {} });
    expect(loaded.defaultProfile).toBe('acme');
    const [a, b] = loaded.registry.list();
    expect(a!.tokenProvider.describe()).toBe('env:PM_ACME');
    expect(a!.baseUrl).toBe('https://purelymail.com');
    expect(b!.tokenProvider.describe()).toBe('keychain:purelymail/beta-key');
    expect(loaded.registry.orgs()).toEqual(['Acme', 'Beta']);
  });

  it('uses default provider when a profile names no token source', () => {
    const path = writeConfig('nosrc.toml', ['[[profile]]', 'name = "p"'].join('\n'));
    const loaded = loadProfiles({ configPath: path, env: {} });
    expect(loaded.registry.require('p').tokenProvider.describe()).toBe('env:PURELYMAIL_API_TOKEN');
  });

  it('falls back to default registry when the file has no profiles', () => {
    const path = writeConfig('emptyprofiles.toml', 'defaultProfile = "x"\n');
    const loaded = loadProfiles({ configPath: path, env: {} });
    expect(loaded.registry.list()).toHaveLength(1);
    expect(loaded.defaultProfile).toBe('x');
  });

  it('defaults the profile name on an empty config', () => {
    const path = writeConfig('empty.toml', '# nothing here\n');
    const loaded = loadProfiles({ configPath: path, env: {} });
    expect(loaded.defaultProfile).toBe('default');
    expect(loaded.registry.list()).toHaveLength(1);
  });

  it('rejects invalid TOML', () => {
    const path = writeConfig('bad.toml', 'this = = broken');
    expect(() => loadProfiles({ configPath: path, env: {} })).toThrow(/parse TOML/);
  });

  it('rejects an invalid schema (missing name)', () => {
    const path = writeConfig('badschema.toml', ['[[profile]]', 'org = "x"'].join('\n'));
    expect(() => loadProfiles({ configPath: path, env: {} })).toThrow(/Invalid config/);
  });

  it('warns on group/other-readable permissions', () => {
    const path = writeConfig('loose.toml', ['[[profile]]', 'name = "p"'].join('\n'));
    chmodSync(path, 0o644);
    const loaded = loadProfiles({ configPath: path, env: {} });
    expect(loaded.warnings.join(' ')).toMatch(/chmod 600/);
  });
});
