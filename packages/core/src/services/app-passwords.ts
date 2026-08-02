/**
 * App-passwords service: create and delete per-user application passwords.
 *
 * @packageDocumentation
 */

import type { CallOptions, OperationSpec, Requester } from '../internal.js';
import {
  createAppPasswordResultSchema,
  createAppPasswordSchema,
  deleteAppPasswordSchema,
  emptyResultSchema,
} from '../schemas.js';
import type {
  CreateAppPasswordInput,
  CreateAppPasswordResult,
  DeleteAppPasswordInput,
  EmptyResult,
} from '../types.js';

const CREATE: OperationSpec<CreateAppPasswordResult> = {
  path: 'createAppPassword',
  requestSchema: createAppPasswordSchema,
  resultSchema: createAppPasswordResultSchema,
  safe: false,
};
const DELETE: OperationSpec<EmptyResult> = {
  path: 'deleteAppPassword',
  requestSchema: deleteAppPasswordSchema,
  resultSchema: emptyResultSchema,
  safe: false,
};

/** Operations on per-user application passwords. */
export class AppPasswordsApi {
  readonly #request: Requester;

  /**
   * @param request - The client's bound request executor.
   */
  public constructor(request: Requester) {
    this.#request = request;
  }

  /**
   * Create an app password for a user.
   *
   * @param input - The full user handle and an optional description.
   * @param options - Per-call overrides.
   * @returns The generated app password (shown once — handle securely).
   */
  public create(
    input: CreateAppPasswordInput,
    options?: CallOptions,
  ): Promise<CreateAppPasswordResult> {
    return this.#request(CREATE, input, options);
  }

  /**
   * Delete an app password.
   *
   * @param input - The username and the full app password to revoke.
   * @param options - Per-call overrides.
   * @returns An empty result on success.
   */
  public delete(input: DeleteAppPasswordInput, options?: CallOptions): Promise<EmptyResult> {
    return this.#request(DELETE, input, options);
  }
}
