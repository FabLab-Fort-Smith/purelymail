import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import {
  PurelymailError,
  type Profile,
  type PurelymailWorkspace,
} from '@fablabfortsmith/purelymail-core';
import { Dashboard } from '../src/components/Dashboard.js';

const dns = { passesMx: true, passesSpf: true, passesDkim: true, passesDmarc: true };

const ws = {
  listDomains: async () => ({
    items: [{ profile: 'a', org: 'acme', name: 'a.com', isShared: false, dnsSummary: dns }],
    failures: [
      { profile: 'bad', org: 'beta', ok: false as const, error: new PurelymailError('down') },
    ],
  }),
  listUsers: async () => ({ items: [], failures: [] }),
  listRoutingRules: async () => ({ items: [], failures: [] }),
  checkCredit: async () => ({ items: [], failures: [] }),
} as unknown as PurelymailWorkspace;

const profiles = [{ name: 'a' } as unknown as Profile];

describe('Dashboard', () => {
  it('renders the domains tab and surfaces a per-account failure', async () => {
    const { lastFrame } = render(<Dashboard workspace={ws} profiles={profiles} />);
    await vi.waitFor(() => {
      expect(lastFrame() ?? '').toContain('a.com');
    });
    const frame = lastFrame() ?? '';
    expect(frame).toContain('PurelyMail — 1 account(s)');
    expect(frame).toContain('domains'); // tab labels
    expect(frame).toContain('bad'); // failure profile surfaced
    expect(frame).toContain('[r] refresh'); // footer / key hints
  });
});
