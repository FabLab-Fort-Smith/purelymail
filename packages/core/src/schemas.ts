/**
 * Zod schemas mirroring the PurelyMail API v0 (verified against the official
 * OpenAPI spec at https://news.purelymail.com/api). Request schemas validate and
 * default outgoing payloads at the boundary (std-owasp-proactive #5). Response
 * schemas validate the fields we rely on while allowing unknown extras
 * (`.passthrough()`) so additive API changes don't break clients
 * (topic-api-consumption).
 *
 * @remarks
 * A few spec fields are under-specified; where so, the modelling choice is noted
 * inline and tracked in COMPLIANCE.md (e.g. the password-reset `type` field,
 * modelled as a string enum).
 *
 * @packageDocumentation
 */

import { z } from 'zod';

/** Non-empty, trimmed string. */
const nonEmpty = z.string().trim().min(1);

/** A full mailbox address, `user@domain.tld`. */
const fullUsername = nonEmpty.refine((v) => v.includes('@'), {
  message: 'must be a full address like "user@domain.com"',
});

/** A domain name (light validation; the API is authoritative). */
const domainName = nonEmpty.refine((v) => v.includes('.') && !v.includes('@'), {
  message: 'must be a bare domain like "domain.com"',
});

/** An email target used in routing/recovery. */
const emailAddress = nonEmpty.refine((v) => v.includes('@'), {
  message: 'must be an email address',
});

// ---------------------------------------------------------------------------
// Requests
// ---------------------------------------------------------------------------

/** Payload for `createUser`. */
export const createUserSchema = z.object({
  userName: nonEmpty.describe('Local part, e.g. "user" in "user@domain.com"'),
  domainName,
  password: z.string().min(1),
  enablePasswordReset: z.boolean().default(true),
  recoveryEmail: emailAddress.optional(),
  recoveryEmailDescription: z.string().optional(),
  recoveryPhone: nonEmpty.optional(),
  recoveryPhoneDescription: z.string().optional(),
  enableSearchIndexing: z.boolean().default(true),
  sendWelcomeEmail: z.boolean().default(true),
});

/** Payload for `deleteUser`. */
export const deleteUserSchema = z.object({ userName: fullUsername });

/** Payload for `getUser`. */
export const getUserSchema = z.object({ userName: fullUsername });

/** Payload for `modifyUser`. */
export const modifyUserSchema = z.object({
  userName: fullUsername,
  newUserName: fullUsername.optional(),
  newPassword: z.string().min(1).optional(),
  enableSearchIndexing: z.boolean().optional(),
  enablePasswordReset: z.boolean().optional(),
  requireTwoFactorAuthentication: z.boolean().optional(),
});

/** Password-reset method type. */
export const passwordResetType = z.enum(['email', 'phone']);

/** Payload for `upsertPasswordReset`. */
export const upsertPasswordResetSchema = z.object({
  userName: nonEmpty,
  existingTarget: nonEmpty.optional(),
  type: passwordResetType,
  target: nonEmpty,
  description: z.string().default(''),
  allowMfaReset: z.boolean().default(true),
});

/** Payload for `deletePasswordReset`. */
export const deletePasswordResetSchema = z.object({
  userName: nonEmpty,
  target: nonEmpty.optional(),
});

/** Payload for `listPasswordReset`. */
export const listPasswordResetSchema = z.object({ userName: nonEmpty });

/** Payload for `createRoutingRule`. */
export const createRoutingRuleSchema = z.object({
  domainName,
  prefix: z.boolean(),
  matchUser: z.string(),
  targetAddresses: z.array(emailAddress).min(1),
  catchall: z.boolean().default(false),
});

/** Payload for `deleteRoutingRule`. */
export const deleteRoutingRuleSchema = z.object({
  routingRuleId: z.number().int(),
});

/** Payload for `addDomain`. */
export const addDomainSchema = z.object({ domainName });

/** Payload for `listDomains`. */
export const listDomainsSchema = z.object({
  includeShared: z.boolean().default(false),
});

/** Payload for `updateDomainSettings`. */
export const updateDomainSettingsSchema = z.object({
  name: domainName,
  allowAccountReset: z.boolean().optional(),
  symbolicSubaddressing: z.boolean().optional(),
  recheckDns: z.boolean().default(false),
});

/** Payload for `deleteDomain`. */
export const deleteDomainSchema = z.object({ name: domainName });

/** Payload for `createAppPassword`. */
export const createAppPasswordSchema = z.object({
  userHandle: fullUsername,
  name: z.string().default(''),
});

/** Payload for `deleteAppPassword`. */
export const deleteAppPasswordSchema = z.object({
  userName: fullUsername,
  appPassword: z.string().min(1),
});

/** The empty request body used by list/get endpoints without parameters. */
export const emptyRequestSchema = z.object({}).default({});

// ---------------------------------------------------------------------------
// Response `result` payloads (passthrough for forward-compat)
// ---------------------------------------------------------------------------

/** Empty result for mutating endpoints. */
export const emptyResultSchema = z.object({}).passthrough();

/** Result of `listUser`. */
export const listUserResultSchema = z.object({ users: z.array(z.string()) }).passthrough();

/** A single password-reset method as returned by `getUser`/`listPasswordReset`. */
export const passwordResetMethodSchema = z
  .object({
    // Spec models `type` inconsistently (empty object vs string); we treat it as
    // a string since the API returns "email"/"phone". Tracked in COMPLIANCE.md.
    type: z.string(),
    target: z.string(),
    description: z.string(),
    allowMfaReset: z.boolean(),
  })
  .passthrough();

/** Result of `getUser`. */
export const getUserResultSchema = z
  .object({
    enableSearchIndexing: z.boolean(),
    recoveryEnabled: z.boolean(),
    requireTwoFactorAuthentication: z.boolean(),
    enableSpamFiltering: z.boolean(),
    resetMethods: z.array(passwordResetMethodSchema),
  })
  .passthrough();

/** Result of `listPasswordReset` (field is named `users` in the API). */
export const listPasswordResetResultSchema = z
  .object({ users: z.array(passwordResetMethodSchema) })
  .passthrough();

/** A routing rule as returned by `listRoutingRules`. */
export const routingRuleSchema = z
  .object({
    id: z.number(),
    domainName: z.string(),
    prefix: z.boolean(),
    matchUser: z.string(),
    targetAddresses: z.array(z.string()),
    catchall: z.boolean(),
  })
  .passthrough();

/** Result of `listRoutingRules`. */
export const listRoutingResultSchema = z
  .object({ rules: z.array(routingRuleSchema) })
  .passthrough();

/** Result of `getOwnershipCode`. */
export const ownershipCodeResultSchema = z.object({ code: z.string() }).passthrough();

/** DNS check summary for a domain. */
export const domainDnsSummarySchema = z
  .object({
    passesMx: z.boolean(),
    passesSpf: z.boolean(),
    passesDkim: z.boolean(),
    passesDmarc: z.boolean(),
  })
  .passthrough();

/** A domain record as returned by `listDomains`. */
export const domainInfoSchema = z
  .object({
    name: z.string(),
    allowAccountReset: z.boolean(),
    symbolicSubaddressing: z.boolean(),
    isShared: z.boolean(),
    dnsSummary: domainDnsSummarySchema,
  })
  .passthrough();

/** Result of `listDomains`. */
export const listDomainsResultSchema = z
  .object({ domains: z.array(domainInfoSchema) })
  .passthrough();

/** Result of `createAppPassword`. */
export const createAppPasswordResultSchema = z.object({ appPassword: z.string() }).passthrough();

/** Result of `checkAccountCredit`. */
export const checkCreditResultSchema = z.object({ credit: z.string() }).passthrough();

// ---------------------------------------------------------------------------
// Envelopes
// ---------------------------------------------------------------------------

/** The provider's error envelope. `type`/`code` may be absent on some errors. */
export const errorEnvelopeSchema = z
  .object({
    type: z.literal('error').optional(),
    code: z.string().optional(),
    message: z.string().optional(),
  })
  .passthrough();
