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
  routingCreate: unknown[];
  routingDelete: unknown[];
}

function makeWs(rec: Recorder): PurelymailWorkspace {
  const client = {
    users: {
      create: (i: unknown) => (rec.create.push(i), Promise.resolve({})),
      modify: (i: unknown) => (rec.modify.push(i), Promise.resolve({})),
      delete: (i: unknown) => (rec.del.push(i), Promise.resolve({})),
    },
    routing: {
      create: (i: unknown) => (rec.routingCreate.push(i), Promise.resolve({})),
      delete: (i: unknown) => (rec.routingDelete.push(i), Promise.resolve({})),
    },
  } as unknown as PurelymailClient;
  return {
    listDomains: () => Promise.resolve({ items: [], failures: [] }),
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
    checkCredit: () => Promise.resolve({ items: [], failures: [] }),
    client: () => client,
  } as unknown as PurelymailWorkspace;
}

function rec(): Recorder {
  return { create: [], modify: [], del: [], routingCreate: [], routingDelete: [] };
}

async function gotoUsers(stdin: { write: (s: string) => void }): Promise<void> {
  await sleep(); // domains settled
  stdin.write('\t'); // -> users
  await sleep();
}

async function gotoRouting(stdin: { write: (s: string) => void }): Promise<void> {
  await sleep(); // domains settled
  stdin.write('\t'); // -> users
  await sleep();
  stdin.write('\t'); // -> routing
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
    stdin.write('\r'); // accept domain -> generate?
    await sleep();
    stdin.write('n'); // do not generate -> password
    await sleep();
    stdin.write('secretpw');
    await sleep();
    stdin.write('\r'); // submit (no notify configured)
    await sleep(100);
    expect(r.create).toHaveLength(1);
    expect(r.create[0]).toMatchObject({ userName: 'admin', domainName: 'a.com' });
    await vi.waitFor(() => expect(lastFrame() ?? '').toContain('Created admin@a.com'));
  });

  it('generates a password and emails details when notify is configured', async () => {
    const r = rec();
    const sends: { to: string; text: string }[] = [];
    const notify = {
      host: 'smtp.x',
      port: 465,
      secure: undefined,
      user: 'admin@d.com',
      from: undefined,
      passwordProvider: {
        getToken: async (): Promise<string> => 'smtp-pw',
        describe: () => 'env:X',
      },
    };
    const { stdin, lastFrame } = render(
      <Dashboard
        workspace={makeWs(r)}
        profiles={profiles}
        notify={notify}
        mailerFactory={() => ({ send: async (m: (typeof sends)[0]) => void sends.push(m) })}
      />,
    );
    await gotoUsers(stdin);
    stdin.write('n'); // new user
    await sleep();
    stdin.write('newbie');
    await sleep();
    stdin.write('\r'); // -> domain
    await sleep();
    stdin.write('\r'); // accept domain -> generate?
    await sleep();
    stdin.write('y'); // generate -> notify?
    await sleep();
    stdin.write('y'); // notify -> recovery email
    await sleep();
    stdin.write('rec@x.com');
    await sleep();
    stdin.write('\r'); // submit
    await sleep(100);
    expect(r.create).toHaveLength(1);
    expect(r.create[0]).toMatchObject({ userName: 'newbie', domainName: 'a.com' });
    await vi.waitFor(() => expect(sends).toHaveLength(1));
    expect(sends[0]!.to).toBe('rec@x.com');
    expect(sends[0]!.text).toContain('newbie@a.com');
    await vi.waitFor(() => expect(lastFrame() ?? '').toContain('emailed rec@x.com'));
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

describe('Dashboard CRUD — routing', () => {
  it('creates a rule via n', async () => {
    const r = rec();
    const { stdin, lastFrame } = render(<Dashboard workspace={makeWs(r)} profiles={profiles} />);
    await gotoRouting(stdin);
    stdin.write('n'); // open create-routing form
    await sleep();
    stdin.write('\r'); // accept prefilled domain a.com -> match
    await sleep();
    stdin.write('sales'); // match local part
    await sleep();
    stdin.write('\r'); // -> targets
    await sleep();
    stdin.write('a@x.com, b@x.com'); // targets
    await sleep();
    stdin.write('\r'); // -> prefix
    await sleep();
    stdin.write('n'); // prefix? no -> catchall
    await sleep();
    stdin.write('n'); // catchall? no -> submit
    await sleep(100);
    expect(r.routingCreate).toHaveLength(1);
    expect(r.routingCreate[0]).toEqual({
      domainName: 'a.com',
      matchUser: 'sales',
      targetAddresses: ['a@x.com', 'b@x.com'],
      prefix: false,
      catchall: false,
    });
    await vi.waitFor(() => expect(lastFrame() ?? '').toContain('Created routing rule on a.com'));
  });

  it('deletes a rule via d + confirm', async () => {
    const r = rec();
    const { stdin, lastFrame } = render(<Dashboard workspace={makeWs(r)} profiles={profiles} />);
    await gotoRouting(stdin);
    stdin.write('d'); // delete selected rule (id 7)
    await sleep();
    expect(lastFrame() ?? '').toContain('Delete routing rule 7');
    stdin.write('y'); // confirm
    await sleep(100);
    expect(r.routingDelete).toEqual([{ routingRuleId: 7 }]);
    await vi.waitFor(() => expect(lastFrame() ?? '').toContain('Deleted rule 7'));
  });
});

describe('Dashboard CRUD — account picker (multi-account)', () => {
  const DOWN = String.fromCharCode(27) + '[B';

  it('routes a create to the account chosen in the picker', async () => {
    const created: { account: string; input: unknown }[] = [];
    const ws = {
      listDomains: () => Promise.resolve({ items: [], failures: [] }),
      listUsers: () =>
        Promise.resolve({ items: [{ profile: 'a', org: 'x', username: 'u@a.com' }], failures: [] }),
      listRoutingRules: () => Promise.resolve({ items: [], failures: [] }),
      checkCredit: () => Promise.resolve({ items: [], failures: [] }),
      client: (p: { name: string }) => ({
        users: {
          create: (input: unknown) => (
            created.push({ account: p.name, input }),
            Promise.resolve({})
          ),
        },
      }),
    } as unknown as PurelymailWorkspace;
    const multi = [{ name: 'a' } as unknown as Profile, { name: 'b' } as unknown as Profile];

    const { stdin, lastFrame } = render(<Dashboard workspace={ws} profiles={multi} />);
    await sleep();
    stdin.write('\t'); // -> users
    await sleep();
    stdin.write('n'); // > 1 account -> account picker
    await sleep();
    expect(lastFrame() ?? '').toContain('Select account for new user');
    stdin.write(DOWN); // move to 'b'
    await sleep();
    stdin.write('\r'); // choose 'b' -> create form
    await sleep();
    stdin.write('newu');
    await sleep();
    stdin.write('\r'); // -> domain (prefilled a.com)
    await sleep();
    stdin.write('\r'); // accept domain -> generate?
    await sleep();
    stdin.write('n'); // no generate -> password
    await sleep();
    stdin.write('pw');
    await sleep();
    stdin.write('\r'); // submit
    await sleep(100);

    expect(created).toHaveLength(1);
    expect(created[0]).toMatchObject({
      account: 'b',
      input: { userName: 'newu', domainName: 'a.com' },
    });
  });
});
