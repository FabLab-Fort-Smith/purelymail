/**
 * Domains service: add, list, ownership code, settings, delete.
 *
 * @packageDocumentation
 */

import type { CallOptions, OperationSpec, Requester } from '../internal.js';
import {
  addDomainSchema,
  deleteDomainSchema,
  emptyRequestSchema,
  emptyResultSchema,
  listDomainsResultSchema,
  listDomainsSchema,
  ownershipCodeResultSchema,
  updateDomainSettingsSchema,
} from '../schemas.js';
import type {
  AddDomainInput,
  DeleteDomainInput,
  EmptyResult,
  ListDomainsInput,
  ListDomainsResult,
  OwnershipCodeResult,
  UpdateDomainSettingsInput,
} from '../types.js';

const LIST: OperationSpec<ListDomainsResult> = {
  path: 'listDomains',
  requestSchema: listDomainsSchema,
  resultSchema: listDomainsResultSchema,
  safe: true,
};
const ADD: OperationSpec<EmptyResult> = {
  path: 'addDomain',
  requestSchema: addDomainSchema,
  resultSchema: emptyResultSchema,
  safe: false,
};
const OWNERSHIP: OperationSpec<OwnershipCodeResult> = {
  path: 'getOwnershipCode',
  requestSchema: emptyRequestSchema,
  resultSchema: ownershipCodeResultSchema,
  safe: true,
};
const UPDATE: OperationSpec<EmptyResult> = {
  path: 'updateDomainSettings',
  requestSchema: updateDomainSettingsSchema,
  resultSchema: emptyResultSchema,
  safe: false,
};
const DELETE: OperationSpec<EmptyResult> = {
  path: 'deleteDomain',
  requestSchema: deleteDomainSchema,
  resultSchema: emptyResultSchema,
  safe: false,
};

/** Operations on domains under a single account. */
export class DomainsApi {
  readonly #request: Requester;

  /**
   * @param request - The client's bound request executor.
   */
  public constructor(request: Requester) {
    this.#request = request;
  }

  /**
   * List domains accessible to the account.
   *
   * @param input - Optionally include PurelyMail shared domains.
   * @param options - Per-call overrides.
   * @returns The domains and their DNS/settings summary.
   */
  public list(input: ListDomainsInput = {}, options?: CallOptions): Promise<ListDomainsResult> {
    return this.#request(LIST, input, options);
  }

  /**
   * Add a domain (must pass DNS checks server-side).
   *
   * @param input - The domain name to add.
   * @param options - Per-call overrides.
   * @returns An empty result on success.
   */
  public add(input: AddDomainInput, options?: CallOptions): Promise<EmptyResult> {
    return this.#request(ADD, input, options);
  }

  /**
   * Get the DNS ownership verification code for adding domains.
   *
   * @param options - Per-call overrides.
   * @returns The ownership code record.
   */
  public getOwnershipCode(options?: CallOptions): Promise<OwnershipCodeResult> {
    return this.#request(OWNERSHIP, {}, options);
  }

  /**
   * Update settings for a domain (account-reset, subaddressing, DNS recheck).
   *
   * @param input - The settings to update.
   * @param options - Per-call overrides.
   * @returns An empty result on success.
   */
  public updateSettings(
    input: UpdateDomainSettingsInput,
    options?: CallOptions,
  ): Promise<EmptyResult> {
    return this.#request(UPDATE, input, options);
  }

  /**
   * Delete a domain.
   *
   * @param input - The domain name to delete.
   * @param options - Per-call overrides.
   * @returns An empty result on success.
   */
  public delete(input: DeleteDomainInput, options?: CallOptions): Promise<EmptyResult> {
    return this.#request(DELETE, input, options);
  }
}
