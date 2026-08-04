import { describe, expect, it, vi } from 'vitest';
import { render } from 'ink-testing-library';
import type {
  Profile,
  PurelymailClient,
  PurelymailWorkspace,
} from '@fablabfortsmith/purelymail-core';
import { Dashboard } from '../src/components/Dashboard.js';

const profiles = [{ name: 'a' } as unknown as Profile];
const sleep = (ms = 60): Promise<void> => new Promise((r) => setTimeout(r, ms));

function makeWs(created: unknown[]): PurelymailWorkspace {
  const client = {
    users: {
      create: (input: unknown) => {
        created.push(input);
        return Promise.resolve({});
      },
    },
  } as unknown as PurelymailClient;
  return {
    listDomains: () => Promise.resolve({ items: [], failures: [] }),
    listUsers: () =>
      Promise.resolve({
        items: [{ profile: 'a', org: 'acme', username: 'u@a.com' }],
        failures: [],
      }),
    listRoutingRules: () => Promise.resolve({ items: [], failures: [] }),
    checkCredit: () => Promise.resolve({ items: [], failures: [] }),
    client: () => client,
  } as unknown as PurelymailWorkspace;
}

describe('Dashboard CRUD — create user', () => {
  it('creates a user through the n flow and confirms', async () => {
    const created: unknown[] = [];
    const { lastFrame, stdin } = render(
      <Dashboard workspace={makeWs(created)} profiles={profiles} />,
    );
    await sleep(); // initial domains view settles
    stdin.write('\t'); // domains -> users
    await sleep();
    stdin.write('n'); // open the create-user form
    await sleep();
    stdin.write('admin'); // local part
    await sleep();
    stdin.write('\r'); // submit -> domain step (prefilled a.com from selected user)
    await sleep();
    stdin.write('\r'); // accept domain -> password step
    await sleep();
    stdin.write('secretpw'); // password
    await sleep();
    stdin.write('\r'); // submit -> create
    await sleep(100);

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      userName: 'admin',
      domainName: 'a.com',
      sendWelcomeEmail: false,
    });
    await vi.waitFor(() => expect(lastFrame() ?? '').toContain('Created admin@a.com'));
  });
});
