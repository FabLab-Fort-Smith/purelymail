/**
 * Mutation layer for the TUI (functional core + thin appliers).
 *
 * The `build*` functions are pure: they shape raw form strings into validated
 * core service inputs (trim, split target lists, booleans) and are unit-tested
 * without Ink. The `apply*`/`delete*` helpers call the single-account client
 * (obtained from `workspace.client(profile)`); the client validates + throws on
 * error, which the form surfaces.
 *
 * @packageDocumentation
 */
import {
  generatePassword,
  type CreateRoutingRuleInput,
  type CreateUserInput,
  type ModifyUserInput,
  type PurelymailClient,
} from '@fablabfortsmith/purelymail-core';
import { buildWelcomeEmail, type EmailMessage } from '@fablabfortsmith/purelymail-notify';

/** Raw values collected by the create-user form. */
export interface NewUserForm {
  readonly localPart: string;
  readonly domain: string;
  readonly password: string;
  readonly sendWelcomeEmail: boolean;
  /** Generate a strong password instead of using `password`. */
  readonly generate: boolean;
  /** Email the account details to `recoveryEmail` after creation. */
  readonly notify: boolean;
  /** Recovery address (also where the welcome email is sent). Blank = none. */
  readonly recoveryEmail: string;
}

/**
 * Resolve the effective password for a create-user form: a freshly generated
 * strong password when `generate` is set, otherwise the typed value.
 *
 * @param form - The collected form.
 * @param gen - Password generator (injectable for deterministic tests).
 * @returns The password to use.
 */
export function resolveNewUserPassword(
  form: NewUserForm,
  gen: () => string = generatePassword,
): string {
  return form.generate ? gen() : form.password;
}

/**
 * Build the welcome message for a newly created user, addressed to their
 * recovery email.
 *
 * @param form - The collected form (supplies address + recovery email).
 * @param password - The mailbox password to include.
 * @returns The email message.
 */
export function buildWelcomeMessage(form: NewUserForm, password: string): EmailMessage {
  return buildWelcomeEmail({
    email: `${form.localPart.trim()}@${form.domain.trim()}`,
    password,
    recoveryEmail: form.recoveryEmail.trim(),
  });
}

/** Raw values collected by the edit-user form (blank = leave unchanged). */
export interface EditUserForm {
  readonly userName: string; // full user@domain being modified
  readonly newLocalPart: string; // blank = no rename
  readonly newPassword: string; // blank = no password change
}

/** Raw values collected by the create-routing form. */
export interface NewRoutingForm {
  readonly domain: string;
  readonly matchUser: string;
  readonly targets: string; // comma-separated
  readonly prefix: boolean;
  readonly catchall: boolean;
}

/** Shape create-user form values into a core {@link CreateUserInput}. */
export function buildCreateUser(form: NewUserForm): CreateUserInput {
  // Fail fast client-side rather than round-tripping an empty password to the
  // API (a caller passing generate=true must pre-resolve via resolveNewUserPassword).
  if (form.password === '') {
    throw new Error('A password is required to create a user.');
  }
  const recovery = form.recoveryEmail.trim();
  return {
    userName: form.localPart.trim(),
    domainName: form.domain.trim(),
    password: form.password,
    sendWelcomeEmail: form.sendWelcomeEmail,
    ...(recovery !== '' ? { recoveryEmail: recovery } : {}),
  };
}

/**
 * Shape edit-user form values into a core {@link ModifyUserInput}. Blank fields
 * are omitted so only the provided changes are sent.
 */
export function buildModifyUser(form: EditUserForm): ModifyUserInput {
  const domain = form.userName.includes('@') ? form.userName.slice(form.userName.indexOf('@')) : '';
  const rename = form.newLocalPart.trim();
  const password = form.newPassword;
  return {
    userName: form.userName,
    ...(rename !== '' ? { newUserName: `${rename}${domain}` } : {}),
    ...(password !== '' ? { newPassword: password } : {}),
  };
}

/** Shape create-routing form values into a core {@link CreateRoutingRuleInput}. */
export function buildCreateRouting(form: NewRoutingForm): CreateRoutingRuleInput {
  return {
    domainName: form.domain.trim(),
    matchUser: form.matchUser.trim(),
    targetAddresses: form.targets
      .split(',')
      .map((t) => t.trim())
      .filter((t) => t !== ''),
    prefix: form.prefix,
    catchall: form.catchall,
  };
}

/** Create a user/mailbox on the given account. */
export function createUser(client: PurelymailClient, form: NewUserForm): Promise<unknown> {
  return client.users.create(buildCreateUser(form));
}

/** Modify a user on the given account. */
export function modifyUser(client: PurelymailClient, form: EditUserForm): Promise<unknown> {
  return client.users.modify(buildModifyUser(form));
}

/** Delete a user/mailbox (full `user@domain`) on the given account. */
export function deleteUser(client: PurelymailClient, userName: string): Promise<unknown> {
  return client.users.delete({ userName });
}

/** Create a routing rule on the given account. */
export function createRouting(client: PurelymailClient, form: NewRoutingForm): Promise<unknown> {
  return client.routing.create(buildCreateRouting(form));
}

/** Delete a routing rule by id on the given account. */
export function deleteRouting(client: PurelymailClient, routingRuleId: number): Promise<unknown> {
  return client.routing.delete({ routingRuleId });
}
