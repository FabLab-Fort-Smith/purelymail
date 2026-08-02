/**
 * Account service: account-level queries such as remaining credit.
 *
 * @packageDocumentation
 */

import type { CallOptions, OperationSpec, Requester } from '../internal.js';
import { checkCreditResultSchema, emptyRequestSchema } from '../schemas.js';
import type { CheckCreditResult } from '../types.js';

const CREDIT: OperationSpec<CheckCreditResult> = {
  path: 'checkAccountCredit',
  requestSchema: emptyRequestSchema,
  resultSchema: checkCreditResultSchema,
  safe: true,
};

/** Account-level operations. */
export class AccountApi {
  readonly #request: Requester;

  /**
   * @param request - The client's bound request executor.
   */
  public constructor(request: Requester) {
    this.#request = request;
  }

  /**
   * Get the account's current credit balance.
   *
   * @param options - Per-call overrides.
   * @returns The credit as a string (currency-formatted by the API).
   */
  public credit(options?: CallOptions): Promise<CheckCreditResult> {
    return this.#request(CREDIT, {}, options);
  }
}
