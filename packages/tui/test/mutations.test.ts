import { describe, expect, it } from 'vitest';
import type { PurelymailClient } from '@fablabfortsmith/purelymail-core';
import {
  buildCreateRouting,
  buildCreateUser,
  buildModifyUser,
  createRouting,
  createUser,
  deleteRouting,
  deleteUser,
  modifyUser,
} from '../src/mutations.js';

describe('build* (pure form -> core input)', () => {
  it('buildCreateUser trims and carries the welcome flag', () => {
    expect(
      buildCreateUser({
        localPart: ' admin ',
        domain: ' a.com ',
        password: 'pw',
        sendWelcomeEmail: false,
      }),
    ).toEqual({ userName: 'admin', domainName: 'a.com', password: 'pw', sendWelcomeEmail: false });
  });

  it('buildModifyUser renames keeping the domain, omits blank fields', () => {
    expect(
      buildModifyUser({ userName: 'old@a.com', newLocalPart: ' new ', newPassword: '' }),
    ).toEqual({
      userName: 'old@a.com',
      newUserName: 'new@a.com',
    });
    expect(
      buildModifyUser({ userName: 'u@a.com', newLocalPart: '', newPassword: 'secret' }),
    ).toEqual({
      userName: 'u@a.com',
      newPassword: 'secret',
    });
    expect(buildModifyUser({ userName: 'u@a.com', newLocalPart: '', newPassword: '' })).toEqual({
      userName: 'u@a.com',
    });
    // No '@' in the username -> rename has no domain suffix.
    expect(buildModifyUser({ userName: 'noat', newLocalPart: 'x', newPassword: '' })).toEqual({
      userName: 'noat',
      newUserName: 'x',
    });
  });

  it('buildCreateRouting splits/trims/filters targets', () => {
    expect(
      buildCreateRouting({
        domain: 'a.com',
        matchUser: ' sales ',
        targets: 'x@a.com, , y@a.com ',
        prefix: true,
        catchall: false,
      }),
    ).toEqual({
      domainName: 'a.com',
      matchUser: 'sales',
      targetAddresses: ['x@a.com', 'y@a.com'],
      prefix: true,
      catchall: false,
    });
  });
});

describe('apply* (calls the right service)', () => {
  function spyClient() {
    const calls: [string, unknown][] = [];
    const rec = (name: string) => (input: unknown) => {
      calls.push([name, input]);
      return Promise.resolve({});
    };
    const client = {
      users: {
        create: rec('users.create'),
        modify: rec('users.modify'),
        delete: rec('users.delete'),
      },
      routing: { create: rec('routing.create'), delete: rec('routing.delete') },
    } as unknown as PurelymailClient;
    return { client, calls };
  }

  it('routes each mutation to its service method', async () => {
    const { client, calls } = spyClient();
    await createUser(client, {
      localPart: 'a',
      domain: 'a.com',
      password: 'p',
      sendWelcomeEmail: true,
    });
    await modifyUser(client, { userName: 'a@a.com', newLocalPart: 'b', newPassword: '' });
    await deleteUser(client, 'a@a.com');
    await createRouting(client, {
      domain: 'a.com',
      matchUser: 's',
      targets: 'x@a.com',
      prefix: false,
      catchall: false,
    });
    await deleteRouting(client, 42);
    expect(calls.map((c) => c[0])).toEqual([
      'users.create',
      'users.modify',
      'users.delete',
      'routing.create',
      'routing.delete',
    ]);
    expect(calls[2]![1]).toEqual({ userName: 'a@a.com' });
    expect(calls[4]![1]).toEqual({ routingRuleId: 42 });
  });
});
