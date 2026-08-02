import { describe, expect, it } from 'vitest';
import {
  addDomainSchema,
  createRoutingRuleSchema,
  createUserSchema,
  deleteUserSchema,
  domainInfoSchema,
  emptyRequestSchema,
  listDomainsResultSchema,
  listDomainsSchema,
  listPasswordResetResultSchema,
  listRoutingResultSchema,
  passwordResetMethodSchema,
  upsertPasswordResetSchema,
} from '../src/schemas.js';

describe('request schema validation', () => {
  it('full username requires @', () => {
    expect(deleteUserSchema.safeParse({ userName: 'a@b.com' }).success).toBe(true);
    expect(deleteUserSchema.safeParse({ userName: 'nope' }).success).toBe(false);
  });

  it('domain must have a dot and no @', () => {
    expect(addDomainSchema.safeParse({ domainName: 'ex.com' }).success).toBe(true);
    expect(addDomainSchema.safeParse({ domainName: 'nodot' }).success).toBe(false);
    expect(addDomainSchema.safeParse({ domainName: 'a@ex.com' }).success).toBe(false);
  });

  it('routing targets must be emails and non-empty', () => {
    expect(
      createRoutingRuleSchema.safeParse({
        domainName: 'd.com',
        prefix: true,
        matchUser: 'x',
        targetAddresses: ['a@b.com'],
      }).success,
    ).toBe(true);
    expect(
      createRoutingRuleSchema.safeParse({
        domainName: 'd.com',
        prefix: true,
        matchUser: 'x',
        targetAddresses: ['bad'],
      }).success,
    ).toBe(false);
    expect(
      createRoutingRuleSchema.safeParse({
        domainName: 'd.com',
        prefix: true,
        matchUser: 'x',
        targetAddresses: [],
      }).success,
    ).toBe(false);
  });

  it('password-reset type is an enum', () => {
    expect(
      upsertPasswordResetSchema.safeParse({ userName: 'u', type: 'email', target: 't' }).success,
    ).toBe(true);
    expect(
      upsertPasswordResetSchema.safeParse({ userName: 'u', type: 'sms', target: 't' }).success,
    ).toBe(false);
  });

  it('rejects an invalid recovery email', () => {
    const bad = createUserSchema.safeParse({
      userName: 'a',
      domainName: 'd.com',
      password: 'p',
      recoveryEmail: 'not-an-email',
    });
    expect(bad.success).toBe(false);
  });

  it('applies defaults', () => {
    const parsed = createUserSchema.parse({ userName: 'a', domainName: 'd.com', password: 'p' });
    expect(parsed.enablePasswordReset).toBe(true);
    expect(listDomainsSchema.parse({}).includeShared).toBe(false);
    expect(emptyRequestSchema.parse(undefined)).toEqual({});
  });
});

describe('response schema validation', () => {
  it('parses a password-reset method', () => {
    const parsed = listPasswordResetResultSchema.parse({
      users: [{ type: 'email', target: 'r@x.com', description: 'primary', allowMfaReset: true }],
    });
    expect(parsed.users[0]!.type).toBe('email');
    expect(passwordResetMethodSchema.safeParse({ type: 'phone' }).success).toBe(false);
  });

  it('parses a routing rule', () => {
    const parsed = listRoutingResultSchema.parse({
      rules: [
        {
          id: 42,
          domainName: 'd.com',
          prefix: false,
          matchUser: 'sales',
          targetAddresses: ['a@d.com'],
          catchall: true,
        },
      ],
    });
    expect(parsed.rules[0]!.id).toBe(42);
  });

  it('parses a domain with dns summary and tolerates extra fields', () => {
    const domain = {
      name: 'd.com',
      allowAccountReset: false,
      symbolicSubaddressing: true,
      isShared: false,
      dnsSummary: { passesMx: true, passesSpf: true, passesDkim: false, passesDmarc: false },
      futureField: 'ignored',
    };
    expect(domainInfoSchema.safeParse(domain).success).toBe(true);
    expect(listDomainsResultSchema.parse({ domains: [domain] }).domains).toHaveLength(1);
  });
});
