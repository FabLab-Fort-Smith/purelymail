import { describe, expect, it } from 'vitest';
import type { PurelymailClient } from '@fablabfortsmith/purelymail-core';
import {
  buildCreateRouting,
  buildCreateUser,
  buildModifyUser,
  buildWelcomeMessage,
  createRouting,
  createUser,
  deleteRouting,
  deleteUser,
  modifyUser,
  resolveNewUserPassword,
  type NewUserForm,
} from '../src/mutations.js';

/** A base create-user form with the new toggles off. */
function form(overrides: Partial<NewUserForm> = {}): NewUserForm {
  return {
    localPart: 'admin',
    domain: 'a.com',
    password: 'pw',
    sendWelcomeEmail: false,
    generate: false,
    notify: false,
    recoveryEmail: '',
    ...overrides,
  };
}

describe('build* (pure form -> core input)', () => {
  it('buildCreateUser trims, carries the welcome flag, omits blank recovery', () => {
    expect(buildCreateUser(form({ localPart: ' admin ', domain: ' a.com ' }))).toEqual({
      userName: 'admin',
      domainName: 'a.com',
      password: 'pw',
      sendWelcomeEmail: false,
    });
  });

  it('buildCreateUser rejects an empty password (fail fast, not via the API)', () => {
    expect(() => buildCreateUser(form({ password: '' }))).toThrow(/password is required/i);
  });

  it('buildCreateUser carries a recovery email when provided', () => {
    expect(buildCreateUser(form({ recoveryEmail: ' rec@x.com ' }))).toMatchObject({
      recoveryEmail: 'rec@x.com',
    });
  });

  it('resolveNewUserPassword uses the generator only when generate is set', () => {
    expect(resolveNewUserPassword(form({ generate: false, password: 'typed' }), () => 'GEN')).toBe(
      'typed',
    );
    expect(resolveNewUserPassword(form({ generate: true }), () => 'GEN')).toBe('GEN');
    // Real generator yields a strong (>=12) password.
    expect(resolveNewUserPassword(form({ generate: true })).length).toBeGreaterThanOrEqual(12);
  });

  it('buildWelcomeMessage addresses the recovery email with the password', () => {
    const m = buildWelcomeMessage(
      form({ localPart: 'new', domain: 'd.com', recoveryEmail: 'r@x.com' }),
      'PW',
    );
    expect(m.to).toBe('r@x.com');
    expect(m.text).toContain('new@d.com');
    expect(m.text).toContain('PW');
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
    await createUser(client, form({ localPart: 'a', password: 'p', sendWelcomeEmail: true }));
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
