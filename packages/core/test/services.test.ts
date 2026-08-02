import { describe, expect, it } from 'vitest';
import { PurelymailClient } from '../src/client.js';
import { FakeTransport, success } from './helpers.js';
import type { HttpResponse } from '../src/http/transport.js';

/** Return a plausible success result per operation path so validation passes. */
function resultFor(path: string): HttpResponse {
  switch (path) {
    case 'listDomains':
      return success(200, { domains: [] });
    case 'getOwnershipCode':
      return success(200, { code: 'own-123' });
    case 'listUser':
      return success(200, { users: ['a@d.com'] });
    case 'getUser':
      return success(200, {
        enableSearchIndexing: true,
        recoveryEnabled: false,
        requireTwoFactorAuthentication: false,
        enableSpamFiltering: true,
        resetMethods: [],
      });
    case 'listRoutingRules':
      return success(200, { rules: [] });
    case 'listPasswordReset':
      return success(200, { users: [] });
    case 'createAppPassword':
      return success(200, { appPassword: 'ap-secret' });
    case 'checkAccountCredit':
      return success(200, { credit: '$3.21' });
    default:
      return success(200, {});
  }
}

function client(): { client: PurelymailClient; transport: FakeTransport } {
  const transport = new FakeTransport((req) => {
    const path = new URL(req.url).pathname.split('/').pop()!;
    return resultFor(path);
  });
  return { client: new PurelymailClient({ token: 't-123456', transport }), transport };
}

function lastPath(t: FakeTransport): string {
  return new URL(t.requests.at(-1)!.url).pathname.split('/').pop()!;
}
function lastBody(t: FakeTransport): Record<string, unknown> {
  return JSON.parse(t.requests.at(-1)!.body);
}

describe('DomainsApi', () => {
  it('maps every method to its endpoint', async () => {
    const { client: c, transport: t } = client();
    await c.domains.list();
    expect(lastPath(t)).toBe('listDomains');
    await c.domains.list({ includeShared: true });
    expect(lastBody(t)).toEqual({ includeShared: true });
    await c.domains.add({ domainName: 'ex.com' });
    expect(lastPath(t)).toBe('addDomain');
    await c.domains.getOwnershipCode();
    expect(lastPath(t)).toBe('getOwnershipCode');
    await c.domains.updateSettings({ name: 'ex.com', recheckDns: true });
    expect(lastPath(t)).toBe('updateDomainSettings');
    await c.domains.delete({ name: 'ex.com' });
    expect(lastPath(t)).toBe('deleteDomain');
  });
});

describe('UsersApi', () => {
  it('maps every method and applies create defaults', async () => {
    const { client: c, transport: t } = client();
    await c.users.list();
    expect(lastPath(t)).toBe('listUser');
    await c.users.get({ userName: 'a@d.com' });
    expect(lastPath(t)).toBe('getUser');
    await c.users.create({ userName: 'a', domainName: 'd.com', password: 'pw' });
    expect(lastPath(t)).toBe('createUser');
    expect(lastBody(t)).toMatchObject({
      userName: 'a',
      domainName: 'd.com',
      password: 'pw',
      enablePasswordReset: true,
      enableSearchIndexing: true,
      sendWelcomeEmail: true,
    });
    await c.users.modify({ userName: 'a@d.com', newPassword: 'x' });
    expect(lastPath(t)).toBe('modifyUser');
    await c.users.delete({ userName: 'a@d.com' });
    expect(lastPath(t)).toBe('deleteUser');
  });
});

describe('RoutingApi', () => {
  it('maps every method', async () => {
    const { client: c, transport: t } = client();
    await c.routing.list();
    expect(lastPath(t)).toBe('listRoutingRules');
    await c.routing.create({
      domainName: 'd.com',
      prefix: false,
      matchUser: 'sales',
      targetAddresses: ['a@d.com'],
    });
    expect(lastPath(t)).toBe('createRoutingRule');
    expect(lastBody(t)).toMatchObject({ catchall: false, targetAddresses: ['a@d.com'] });
    await c.routing.delete({ routingRuleId: 7 });
    expect(lastBody(t)).toEqual({ routingRuleId: 7 });
  });
});

describe('PasswordResetApi', () => {
  it('maps every method', async () => {
    const { client: c, transport: t } = client();
    await c.passwordResets.list({ userName: 'a@d.com' });
    expect(lastPath(t)).toBe('listPasswordReset');
    await c.passwordResets.upsert({ userName: 'a@d.com', type: 'email', target: 'r@x.com' });
    expect(lastPath(t)).toBe('upsertPasswordReset');
    expect(lastBody(t)).toMatchObject({ allowMfaReset: true, description: '' });
    await c.passwordResets.delete({ userName: 'a@d.com', target: 'r@x.com' });
    expect(lastPath(t)).toBe('deletePasswordReset');
  });
});

describe('AppPasswordsApi', () => {
  it('maps every method', async () => {
    const { client: c, transport: t } = client();
    const created = await c.appPasswords.create({ userHandle: 'a@d.com' });
    expect(lastPath(t)).toBe('createAppPassword');
    expect(created.appPassword).toBe('ap-secret');
    await c.appPasswords.delete({ userName: 'a@d.com', appPassword: 'ap-secret' });
    expect(lastPath(t)).toBe('deleteAppPassword');
  });
});

describe('AccountApi', () => {
  it('maps credit', async () => {
    const { client: c, transport: t } = client();
    const res = await c.account.credit();
    expect(lastPath(t)).toBe('checkAccountCredit');
    expect(res.credit).toBe('$3.21');
  });
});
