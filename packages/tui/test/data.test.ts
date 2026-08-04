import { describe, expect, it } from 'vitest';
import {
  PurelymailError,
  type Profile,
  type PurelymailWorkspace,
} from '@fablabfortsmith/purelymail-core';
import { fetchTab, TABS } from '../src/data.js';

// Two failures — one with an org, one without — to exercise both `org ?? ''` sides.
const failWithOrg = {
  profile: 'bad',
  org: 'beta',
  ok: false as const,
  error: new PurelymailError('down'),
};
const failNoOrg = {
  profile: 'bad2',
  org: undefined,
  ok: false as const,
  error: new PurelymailError('nope'),
};

const dnsOk = { passesMx: true, passesSpf: true, passesDkim: false, passesDmarc: true };

// Each aggregator returns one org'd row and one org-less row so both branches of
// every `org ?? ''` are covered.
const ws = {
  listDomains: async () => ({
    items: [
      { profile: 'a', org: 'acme', name: 'a.com', isShared: false, dnsSummary: dnsOk },
      { profile: 'b', org: undefined, name: 'b.com', isShared: true, dnsSummary: dnsOk },
    ],
    failures: [failWithOrg, failNoOrg],
  }),
  listUsers: async () => ({
    items: [
      { profile: 'a', org: 'acme', username: 'u@a.com' },
      { profile: 'b', org: undefined, username: 'v@b.com' },
    ],
    failures: [],
  }),
  listRoutingRules: async () => ({
    items: [
      {
        profile: 'a',
        org: 'acme',
        id: 7,
        domainName: 'a.com',
        prefix: false,
        matchUser: 'info',
        targetAddresses: ['x@a.com', 'y@a.com'],
        catchall: false,
      },
      {
        profile: 'b',
        org: undefined,
        id: 8,
        domainName: 'b.com',
        prefix: false,
        matchUser: '',
        targetAddresses: [],
        catchall: true,
      },
    ],
    failures: [],
  }),
  checkCredit: async () => ({
    items: [
      { profile: 'a', org: 'acme', credit: '12.40' },
      { profile: 'b', org: undefined, credit: '0.00' },
    ],
    failures: [],
  }),
} as unknown as PurelymailWorkspace;

const profiles: readonly Profile[] = [];

describe('fetchTab', () => {
  it('shapes domains with DNS glyphs and surfaces failures (org present + absent)', async () => {
    const m = await fetchTab(ws, profiles, 'domains');
    expect(m.columns).toContain('dkim');
    expect(m.rows[0]).toMatchObject({ domain: 'a.com', org: 'acme', mx: '✓', dkim: '✗' });
    expect(m.rows[1]).toMatchObject({ org: '', shared: '✓' });
    expect(m.failures).toEqual([
      { profile: 'bad', org: 'beta', error: 'down' },
      { profile: 'bad2', org: '', error: 'nope' },
    ]);
  });

  it('shapes users (empty org -> "")', async () => {
    const m = await fetchTab(ws, profiles, 'users');
    expect(m.rows.map((r) => r['org'])).toEqual(['acme', '']);
    expect(m.rows[1]).toMatchObject({ username: 'v@b.com' });
  });

  it('shapes routing rules (id stringified, targets joined)', async () => {
    const m = await fetchTab(ws, profiles, 'routing');
    expect(m.rows[0]).toMatchObject({ id: '7', match: 'info', targets: 'x@a.com,y@a.com' });
    expect(m.rows[1]).toMatchObject({ id: '8', org: '', targets: '' });
  });

  it('shapes credit', async () => {
    const m = await fetchTab(ws, profiles, 'credit');
    expect(m.rows.map((r) => r['credit'])).toEqual(['12.40', '0.00']);
  });

  it('covers every declared tab', async () => {
    for (const tab of TABS) {
      const m = await fetchTab(ws, profiles, tab);
      expect(m.columns.length).toBeGreaterThan(0);
    }
  });
});
