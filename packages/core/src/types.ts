/**
 * Public TypeScript types inferred from the {@link module:schemas | schemas}.
 *
 * Request types use the schema *input* (defaults optional for callers); result
 * types use the parsed output. These are the stable contract consumers program
 * against.
 *
 * @packageDocumentation
 */

import type { z } from 'zod';
import type {
  addDomainSchema,
  checkCreditResultSchema,
  createAppPasswordResultSchema,
  createAppPasswordSchema,
  createRoutingRuleSchema,
  createUserSchema,
  emptyResultSchema,
  deleteAppPasswordSchema,
  deleteDomainSchema,
  deletePasswordResetSchema,
  deleteRoutingRuleSchema,
  deleteUserSchema,
  domainInfoSchema,
  getUserResultSchema,
  getUserSchema,
  listDomainsResultSchema,
  listDomainsSchema,
  listPasswordResetResultSchema,
  listPasswordResetSchema,
  listRoutingResultSchema,
  listUserResultSchema,
  modifyUserSchema,
  ownershipCodeResultSchema,
  passwordResetMethodSchema,
  routingRuleSchema,
  updateDomainSettingsSchema,
  upsertPasswordResetSchema,
} from './schemas.js';

/** Input for `createUser`. */
export type CreateUserInput = z.input<typeof createUserSchema>;
/** Input for `deleteUser`. */
export type DeleteUserInput = z.input<typeof deleteUserSchema>;
/** Input for `getUser`. */
export type GetUserInput = z.input<typeof getUserSchema>;
/** Input for `modifyUser`. */
export type ModifyUserInput = z.input<typeof modifyUserSchema>;
/** Input for `upsertPasswordReset`. */
export type UpsertPasswordResetInput = z.input<typeof upsertPasswordResetSchema>;
/** Input for `deletePasswordReset`. */
export type DeletePasswordResetInput = z.input<typeof deletePasswordResetSchema>;
/** Input for `listPasswordReset`. */
export type ListPasswordResetInput = z.input<typeof listPasswordResetSchema>;
/** Input for `createRoutingRule`. */
export type CreateRoutingRuleInput = z.input<typeof createRoutingRuleSchema>;
/** Input for `deleteRoutingRule`. */
export type DeleteRoutingRuleInput = z.input<typeof deleteRoutingRuleSchema>;
/** Input for `addDomain`. */
export type AddDomainInput = z.input<typeof addDomainSchema>;
/** Input for `listDomains`. */
export type ListDomainsInput = z.input<typeof listDomainsSchema>;
/** Input for `updateDomainSettings`. */
export type UpdateDomainSettingsInput = z.input<typeof updateDomainSettingsSchema>;
/** Input for `deleteDomain`. */
export type DeleteDomainInput = z.input<typeof deleteDomainSchema>;
/** Input for `createAppPassword`. */
export type CreateAppPasswordInput = z.input<typeof createAppPasswordSchema>;
/** Input for `deleteAppPassword`. */
export type DeleteAppPasswordInput = z.input<typeof deleteAppPasswordSchema>;

/** Empty result returned by mutating endpoints. */
export type EmptyResult = z.infer<typeof emptyResultSchema>;
/** A single password-reset method. */
export type PasswordResetMethod = z.infer<typeof passwordResetMethodSchema>;
/** A routing rule. */
export type RoutingRule = z.infer<typeof routingRuleSchema>;
/** A domain record. */
export type DomainInfo = z.infer<typeof domainInfoSchema>;

/** Result of `listUser`. */
export type ListUserResult = z.infer<typeof listUserResultSchema>;
/** Result of `getUser`. */
export type GetUserResult = z.infer<typeof getUserResultSchema>;
/** Result of `listPasswordReset`. */
export type ListPasswordResetResult = z.infer<typeof listPasswordResetResultSchema>;
/** Result of `listRoutingRules`. */
export type ListRoutingResult = z.infer<typeof listRoutingResultSchema>;
/** Result of `getOwnershipCode`. */
export type OwnershipCodeResult = z.infer<typeof ownershipCodeResultSchema>;
/** Result of `listDomains`. */
export type ListDomainsResult = z.infer<typeof listDomainsResultSchema>;
/** Result of `createAppPassword`. */
export type CreateAppPasswordResult = z.infer<typeof createAppPasswordResultSchema>;
/** Result of `checkAccountCredit`. */
export type CheckCreditResult = z.infer<typeof checkCreditResultSchema>;
