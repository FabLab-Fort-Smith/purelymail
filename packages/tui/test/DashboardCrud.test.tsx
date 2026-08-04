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

interface Recorder {
  create: unknown[];
  modify: unknown[];
  del: unknown[];
}

function makeWs(rec: Recorder): PurelymailWorkspace {
  const client = {
    users: {
      create: (i: unknown) => (rec.create.push(i), Promise.resolve({})),
      modify: (i: unknown) => (rec.modify.push(i), Promise.resolve({})),
      delete: (i: unknown) => (rec.del.push(i), Promise.resolve({})),
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

function rec(): Recorder {
  return { create: [], modify: [], del: [] };
}

async function gotoUsers(stdin: { write: (s: string) => void }): Promise<void> {
  await sleep(); // domains settled
  stdin.write('\t'); // -> users
  await sleep();
}

describe('Dashboard CRUD — users', () => {
  it('creates via n', async () => {
    const r = rec();
    const { stdin, lastFrame } = render(<Dashboard workspace={makeWs(r)} profiles={profiles} />);
    await gotoUsers(stdin);
    stdin.write('n');
    await sleep();
    stdin.write('admin');
    await sleep();
    stdin.write('\r'); // -> domain (prefilled a.com)
    await sleep();
    stdin.write('\r'); // accept domain -> password
    await sleep();
    stdin.write('secretpw');
    await sleep();
    stdin.write('\r'); // submit
    await sleep(100);
    expect(r.create).toHaveLength(1);
    expect(r.create[0]).toMatchObject({ userName: 'admin', domainName: 'a.com' });
    await vi.waitFor(() => expect(lastFrame() ?? '').toContain('Created admin@a.com'));
  });

  it('edits (rename) via e', async () => {
    const r = rec();
    const { stdin, lastFrame } = render(<Dashboard workspace={makeWs(r)} profiles={profiles} />);
    await gotoUsers(stdin);
    stdin.write('e'); // edit selected user (u@a.com)
    await sleep();
    stdin.write('newname');
    await sleep();
    stdin.write('\r'); // submit new local part -> password step
    await sleep();
    stdin.write('\r'); // blank password (unchanged) -> submit
    await sleep(100);
    expect(r.modify).toHaveLength(1);
    expect(r.modify[0]).toEqual({ userName: 'u@a.com', newUserName: 'newname@a.com' });
    await vi.waitFor(() => expect(lastFrame() ?? '').toContain('Updated u@a.com'));
  });

  it('deletes via d + confirm', async () => {
    const r = rec();
    const { stdin, lastFrame } = render(<Dashboard workspace={makeWs(r)} profiles={profiles} />);
    await gotoUsers(stdin);
    stdin.write('d'); // delete selected -> confirm
    await sleep();
    expect(lastFrame() ?? '').toContain('Delete u@a.com?');
    stdin.write('y'); // confirm
    await sleep(100);
    expect(r.del).toEqual([{ userName: 'u@a.com' }]);
    await vi.waitFor(() => expect(lastFrame() ?? '').toContain('Deleted u@a.com'));
  });

  it('cancels a delete with n', async () => {
    const r = rec();
    const { stdin, lastFrame } = render(<Dashboard workspace={makeWs(r)} profiles={profiles} />);
    await gotoUsers(stdin);
    stdin.write('d');
    await sleep();
    stdin.write('n'); // decline
    await sleep();
    expect(r.del).toHaveLength(0);
    expect(lastFrame() ?? '').not.toContain('Delete u@a.com?');
  });
});
