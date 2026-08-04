import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import {
  PurelymailError,
  type Profile,
  type PurelymailWorkspace,
} from '@fablabfortsmith/purelymail-core';
import { Dashboard } from '../src/components/Dashboard.js';

const dns = { passesMx: true, passesSpf: true, passesDkim: true, passesDmarc: true };
const profiles = [{ name: 'a' } as unknown as Profile];

/** A fake workspace with data in every tab; counts domain fetches (for refresh). */
function makeWs(counter?: { domains: number }): PurelymailWorkspace {
  return {
    listDomains: () => {
      if (counter) counter.domains += 1;
      return Promise.resolve({
        items: [{ profile: 'a', org: 'acme', name: 'a.com', isShared: false, dnsSummary: dns }],
        failures: [
          { profile: 'bad', org: 'beta', ok: false as const, error: new PurelymailError('down') },
        ],
      });
    },
    listUsers: () =>
      Promise.resolve({
        items: [{ profile: 'a', org: 'acme', username: 'u@a.com' }],
        failures: [],
      }),
    listRoutingRules: () =>
      Promise.resolve({
        items: [
          {
            profile: 'a',
            org: 'acme',
            id: 7,
            domainName: 'a.com',
            prefix: false,
            matchUser: 'info',
            targetAddresses: ['x@a.com'],
            catchall: false,
          },
        ],
        failures: [],
      }),
    checkCredit: () =>
      Promise.resolve({ items: [{ profile: 'a', org: 'acme', credit: '12.40' }], failures: [] }),
  } as unknown as PurelymailWorkspace;
}

const KEY = {
  tab: String.fromCharCode(9),
  right: String.fromCharCode(27) + '[C',
  left: String.fromCharCode(27) + '[D',
};

describe('Dashboard', () => {
  it('renders the domains tab and surfaces a per-account failure', async () => {
    const { lastFrame } = render(<Dashboard workspace={makeWs()} profiles={profiles} />);
    await vi.waitFor(() => expect(lastFrame() ?? '').toContain('a.com'));
    const frame = lastFrame() ?? '';
    expect(frame).toContain('PurelyMail — 1 account(s)');
    expect(frame).toContain('bad'); // failure profile surfaced
    expect(frame).toContain('[r] refresh');
  });

  it('switches views with tab / arrow keys', async () => {
    const { lastFrame, stdin } = render(<Dashboard workspace={makeWs()} profiles={profiles} />);
    await vi.waitFor(() => expect(lastFrame() ?? '').toContain('a.com'));

    stdin.write(KEY.tab); // -> users
    await vi.waitFor(() => expect(lastFrame() ?? '').toContain('u@a.com'));

    stdin.write(KEY.right); // -> routing
    await vi.waitFor(() => expect(lastFrame() ?? '').toContain('info'));

    stdin.write(KEY.right); // -> credit
    await vi.waitFor(() => expect(lastFrame() ?? '').toContain('12.40'));

    stdin.write(KEY.left); // back to routing
    await vi.waitFor(() => expect(lastFrame() ?? '').toContain('info'));
  });

  it('re-fetches on refresh (r)', async () => {
    const counter = { domains: 0 };
    const { lastFrame, stdin } = render(
      <Dashboard workspace={makeWs(counter)} profiles={profiles} />,
    );
    await vi.waitFor(() => expect(lastFrame() ?? '').toContain('a.com'));
    const before = counter.domains;
    stdin.write('r');
    await vi.waitFor(() => expect(counter.domains).toBeGreaterThan(before));
  });

  it('shows an error when a fetch rejects', async () => {
    const ws = {
      listDomains: () => Promise.reject(new PurelymailError('boom')),
      listUsers: () => Promise.resolve({ items: [], failures: [] }),
      listRoutingRules: () => Promise.resolve({ items: [], failures: [] }),
      checkCredit: () => Promise.resolve({ items: [], failures: [] }),
    } as unknown as PurelymailWorkspace;
    const { lastFrame } = render(<Dashboard workspace={ws} profiles={profiles} />);
    await vi.waitFor(() => expect(lastFrame() ?? '').toContain('Error: boom'));
  });

  it('renders an empty-state when a tab has no rows', async () => {
    const ws = {
      listDomains: () => Promise.resolve({ items: [], failures: [] }),
      listUsers: () => Promise.resolve({ items: [], failures: [] }),
      listRoutingRules: () => Promise.resolve({ items: [], failures: [] }),
      checkCredit: () => Promise.resolve({ items: [], failures: [] }),
    } as unknown as PurelymailWorkspace;
    const { lastFrame } = render(<Dashboard workspace={ws} profiles={profiles} />);
    await vi.waitFor(() => expect(lastFrame() ?? '').toContain('(no rows)'));
  });

  it('quits on q without throwing', async () => {
    const { stdin, lastFrame } = render(<Dashboard workspace={makeWs()} profiles={profiles} />);
    await vi.waitFor(() => expect(lastFrame() ?? '').toContain('a.com'));
    expect(() => stdin.write('q')).not.toThrow();
  });
});
