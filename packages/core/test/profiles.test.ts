import { describe, expect, it } from 'vitest';
import { ProfileRegistry, type Profile } from '../src/profiles.js';
import { StaticTokenProvider } from '../src/auth/token-provider.js';
import { PurelymailConfigError } from '../src/errors.js';

const tp = new StaticTokenProvider('t-123456');
function profile(name: string, org?: string): Profile {
  return org === undefined ? { name, tokenProvider: tp } : { name, org, tokenProvider: tp };
}

describe('ProfileRegistry', () => {
  it('rejects empty and duplicate names', () => {
    expect(() => new ProfileRegistry([profile('')])).toThrow(PurelymailConfigError);
    expect(() => new ProfileRegistry([profile('a'), profile('a')])).toThrow(PurelymailConfigError);
  });

  it('lists, gets, and requires', () => {
    const reg = new ProfileRegistry([profile('a', 'acme'), profile('b')]);
    expect(reg.list().map((p) => p.name)).toEqual(['a', 'b']);
    expect(reg.get('a')?.name).toBe('a');
    expect(reg.get('missing')).toBeUndefined();
    expect(reg.require('b').name).toBe('b');
    expect(() => reg.require('missing')).toThrow(PurelymailConfigError);
  });

  it('groups by org and lists distinct sorted orgs', () => {
    const reg = new ProfileRegistry([
      profile('a', 'zeta'),
      profile('b', 'acme'),
      profile('c', 'acme'),
      profile('d'),
    ]);
    expect(reg.byOrg('acme').map((p) => p.name)).toEqual(['b', 'c']);
    expect(reg.orgs()).toEqual(['acme', 'zeta']);
  });

  it('selects by all / org / names, and fails closed otherwise', () => {
    const reg = new ProfileRegistry([profile('a', 'acme'), profile('b', 'acme'), profile('c')]);
    expect(reg.select({ all: true })).toHaveLength(3);
    expect(reg.select({ org: 'acme' }).map((p) => p.name)).toEqual(['a', 'b']);
    expect(reg.select({ names: ['c'] }).map((p) => p.name)).toEqual(['c']);
    expect(() => reg.select({ org: 'nope' })).toThrow(PurelymailConfigError);
    expect(() => reg.select({})).toThrow(PurelymailConfigError);
  });
});
