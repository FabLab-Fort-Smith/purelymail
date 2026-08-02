/**
 * Users service: list, get, create, modify, delete mailboxes.
 *
 * @packageDocumentation
 */

import type { CallOptions, OperationSpec, Requester } from '../internal.js';
import {
  createUserSchema,
  deleteUserSchema,
  emptyRequestSchema,
  emptyResultSchema,
  getUserResultSchema,
  getUserSchema,
  listUserResultSchema,
  modifyUserSchema,
} from '../schemas.js';
import type {
  CreateUserInput,
  DeleteUserInput,
  EmptyResult,
  GetUserInput,
  GetUserResult,
  ListUserResult,
  ModifyUserInput,
} from '../types.js';

const LIST: OperationSpec<ListUserResult> = {
  path: 'listUser',
  requestSchema: emptyRequestSchema,
  resultSchema: listUserResultSchema,
  safe: true,
};
const GET: OperationSpec<GetUserResult> = {
  path: 'getUser',
  requestSchema: getUserSchema,
  resultSchema: getUserResultSchema,
  safe: true,
};
const CREATE: OperationSpec<EmptyResult> = {
  path: 'createUser',
  requestSchema: createUserSchema,
  resultSchema: emptyResultSchema,
  safe: false,
};
const MODIFY: OperationSpec<EmptyResult> = {
  path: 'modifyUser',
  requestSchema: modifyUserSchema,
  resultSchema: emptyResultSchema,
  safe: false,
};
const DELETE: OperationSpec<EmptyResult> = {
  path: 'deleteUser',
  requestSchema: deleteUserSchema,
  resultSchema: emptyResultSchema,
  safe: false,
};

/** Operations on users/mailboxes under a single account. */
export class UsersApi {
  readonly #request: Requester;

  /**
   * @param request - The client's bound request executor.
   */
  public constructor(request: Requester) {
    this.#request = request;
  }

  /**
   * List all usernames under the account.
   *
   * @param options - Per-call overrides.
   * @returns The list of full usernames.
   */
  public list(options?: CallOptions): Promise<ListUserResult> {
    return this.#request(LIST, {}, options);
  }

  /**
   * Get a single user's settings and reset methods.
   *
   * @param input - The full username.
   * @param options - Per-call overrides.
   * @returns The user's settings.
   */
  public get(input: GetUserInput, options?: CallOptions): Promise<GetUserResult> {
    return this.#request(GET, input, options);
  }

  /**
   * Create a user/mailbox.
   *
   * @param input - New user details (local part, domain, password, options).
   * @param options - Per-call overrides.
   * @returns An empty result on success.
   */
  public create(input: CreateUserInput, options?: CallOptions): Promise<EmptyResult> {
    return this.#request(CREATE, input, options);
  }

  /**
   * Modify a user (rename, reset password, toggle settings/2FA).
   *
   * @param input - The changes to apply.
   * @param options - Per-call overrides.
   * @returns An empty result on success.
   */
  public modify(input: ModifyUserInput, options?: CallOptions): Promise<EmptyResult> {
    return this.#request(MODIFY, input, options);
  }

  /**
   * Delete a user/mailbox.
   *
   * @param input - The full username to delete.
   * @param options - Per-call overrides.
   * @returns An empty result on success.
   */
  public delete(input: DeleteUserInput, options?: CallOptions): Promise<EmptyResult> {
    return this.#request(DELETE, input, options);
  }
}
