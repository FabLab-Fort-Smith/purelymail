import { mkdtempSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { PurelymailConfigError } from '@fablabfortsmith/purelymail-core';
import {
  addProfileEntry,
  readConfigData,
  removeProfileEntry,
  setDefaultProfile,
  upsertProfileEntry,
  writeConfigData,
} from '../src/config-store.js';

const tmp = mkdtempSync(join(tmpdir(), 'pm-store-'));

describe('readConfigData', () => {
  it('returns empty for a missing file', () => {
    expect(readConfigData(join(tmp, 'nope.toml'))).toEqual({ profile: [] });
  });
  it('parses a valid file', () => {
    const p = join(tmp, 'ok.toml');
    writeFileSync(
      p,
      ['defaultProfile = "a"', '[[profile]]', 'name = "a"', 'tokenEnv = "X"'].join('\n'),
    );
    const data = readConfigData(p);
    expect(data.defaultProfile).toBe('a');
    expect(data.profile).toHaveLength(1);
  });
  it('defaults profile to an empty array when the file has none', () => {
    const p = join(tmp, 'onlydefault.toml');
    writeFileSync(p, 'defaultProfile = "a"\n');
    expect(readConfigData(p)).toEqual({ defaultProfile: 'a', profile: [] });
  });

  it('rejects invalid TOML and invalid schema', () => {
    const bad = join(tmp, 'bad.toml');
    writeFileSync(bad, 'x = = y');
    expect(() => readConfigData(bad)).toThrow(/parse TOML/);
    const badSchema = join(tmp, 'badschema.toml');
    writeFileSync(badSchema, ['[[profile]]', 'org = "x"'].join('\n'));
    expect(() => readConfigData(badSchema)).toThrow(/Invalid config/);
  });
});

describe('writeConfigData', () => {
  it('writes 0600 TOML that round-trips', () => {
    const p = join(tmp, 'sub', 'dir', 'config.toml');
    writeConfigData(p, { defaultProfile: 'a', profile: [{ name: 'a', tokenEnv: 'X' }] });
    expect((statSync(p).mode & 0o777).toString(8)).toBe('600');
    expect(readFileSync(p, 'utf8')).toContain('name = "a"');
    expect(readConfigData(p).defaultProfile).toBe('a');
  });
  it('tightens permissions to 0600 when overwriting a looser file', () => {
    const p = join(tmp, 'loose.toml');
    writeFileSync(p, 'defaultProfile = "a"\n', { mode: 0o644 });
    writeConfigData(p, { profile: [{ name: 'a', tokenEnv: 'A' }] });
    expect((statSync(p).mode & 0o777).toString(8)).toBe('600');
  });

  it('writes without a default profile', () => {
    const p = join(tmp, 'nodefault.toml');
    writeConfigData(p, { profile: [{ name: 'a', keychain: true, keychainAccount: 'a' }] });
    expect(readConfigData(p).defaultProfile).toBeUndefined();
  });
});

describe('mutations', () => {
  const base = { profile: [{ name: 'a', tokenEnv: 'A' }] };

  it('adds and rejects duplicates', () => {
    const next = addProfileEntry(base, { name: 'b', tokenEnv: 'B' });
    expect(next.profile).toHaveLength(2);
    expect(() => addProfileEntry(next, { name: 'a', tokenEnv: 'X' })).toThrow(
      PurelymailConfigError,
    );
  });

  it('adds to a config with no existing profile array', () => {
    const next = addProfileEntry({}, { name: 'solo', tokenEnv: 'S' });
    expect(next.profile).toEqual([{ name: 'solo', tokenEnv: 'S' }]);
  });

  it('upserts (add then replace)', () => {
    const added = upsertProfileEntry(base, { name: 'b', tokenEnv: 'B' });
    expect(added.profile).toHaveLength(2);
    const replaced = upsertProfileEntry(added, { name: 'b', tokenEnv: 'B2' });
    expect(replaced.profile).toHaveLength(2);
    expect(replaced.profile!.find((p) => p.name === 'b')!.tokenEnv).toBe('B2');
  });

  it('removes and clears a stale default', () => {
    const data = { defaultProfile: 'a', profile: [{ name: 'a', tokenEnv: 'A' }] };
    const next = removeProfileEntry(data, 'a');
    expect(next.profile).toHaveLength(0);
    expect(next.defaultProfile).toBeUndefined();
    expect(() => removeProfileEntry(next, 'missing')).toThrow(PurelymailConfigError);
  });

  it('preserves the default when a different profile is removed', () => {
    const data = {
      defaultProfile: 'a',
      profile: [
        { name: 'a', tokenEnv: 'A' },
        { name: 'b', tokenEnv: 'B' },
      ],
    };
    const next = removeProfileEntry(data, 'b');
    expect(next.defaultProfile).toBe('a');
    expect(next.profile!.map((p) => p.name)).toEqual(['a']);
  });

  it('sets a default that must exist', () => {
    expect(setDefaultProfile(base, 'a').defaultProfile).toBe('a');
    expect(() => setDefaultProfile(base, 'missing')).toThrow(PurelymailConfigError);
  });
});
