/**
 * Password-reset methods service: list, upsert, delete recovery methods.
 *
 * These are the account-security recovery methods (email/phone) that let a user
 * reset their password and optionally their MFA.
 *
 * @packageDocumentation
 */

import type { CallOptions, OperationSpec, Requester } from '../internal.js';
import {
  deletePasswordResetSchema,
  emptyResultSchema,
  listPasswordResetResultSchema,
  listPasswordResetSchema,
  upsertPasswordResetSchema,
} from '../schemas.js';
import type {
  DeletePasswordResetInput,
  EmptyResult,
  ListPasswordResetInput,
  ListPasswordResetResult,
  UpsertPasswordResetInput,
} from '../types.js';

const LIST: OperationSpec<ListPasswordResetResult> = {
  path: 'listPasswordReset',
  requestSchema: listPasswordResetSchema,
  resultSchema: listPasswordResetResultSchema,
  safe: true,
};
const UPSERT: OperationSpec<EmptyResult> = {
  path: 'upsertPasswordReset',
  requestSchema: upsertPasswordResetSchema,
  resultSchema: emptyResultSchema,
  safe: false,
};
const DELETE: OperationSpec<EmptyResult> = {
  path: 'deletePasswordReset',
  requestSchema: deletePasswordResetSchema,
  resultSchema: emptyResultSchema,
  safe: false,
};

/** Operations on a user's password-reset (recovery) methods. */
export class PasswordResetApi {
  readonly #request: Requester;

  /**
   * @param request - The client's bound request executor.
   */
  public constructor(request: Requester) {
    this.#request = request;
  }

  /**
   * List a user's password-reset methods.
   *
   * @param input - The username to query.
   * @param options - Per-call overrides.
   * @returns The reset methods for the user.
   */
  public list(
    input: ListPasswordResetInput,
    options?: CallOptions,
  ): Promise<ListPasswordResetResult> {
    return this.#request(LIST, input, options);
  }

  /**
   * Create or update a password-reset method (email or phone).
   *
   * @param input - Method details; set `existingTarget` to update in place.
   * @param options - Per-call overrides.
   * @returns An empty result on success.
   */
  public upsert(input: UpsertPasswordResetInput, options?: CallOptions): Promise<EmptyResult> {
    return this.#request(UPSERT, input, options);
  }

  /**
   * Delete a password-reset method.
   *
   * @param input - The username and optional target to remove.
   * @param options - Per-call overrides.
   * @returns An empty result on success.
   */
  public delete(input: DeletePasswordResetInput, options?: CallOptions): Promise<EmptyResult> {
    return this.#request(DELETE, input, options);
  }
}
