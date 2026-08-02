/**
 * Routing service: list, create, delete routing rules.
 *
 * @packageDocumentation
 */

import type { CallOptions, OperationSpec, Requester } from '../internal.js';
import {
  createRoutingRuleSchema,
  deleteRoutingRuleSchema,
  emptyRequestSchema,
  emptyResultSchema,
  listRoutingResultSchema,
} from '../schemas.js';
import type {
  CreateRoutingRuleInput,
  DeleteRoutingRuleInput,
  EmptyResult,
  ListRoutingResult,
} from '../types.js';

const LIST: OperationSpec<ListRoutingResult> = {
  path: 'listRoutingRules',
  requestSchema: emptyRequestSchema,
  resultSchema: listRoutingResultSchema,
  safe: true,
};
const CREATE: OperationSpec<EmptyResult> = {
  path: 'createRoutingRule',
  requestSchema: createRoutingRuleSchema,
  resultSchema: emptyResultSchema,
  safe: false,
};
const DELETE: OperationSpec<EmptyResult> = {
  path: 'deleteRoutingRule',
  requestSchema: deleteRoutingRuleSchema,
  resultSchema: emptyResultSchema,
  safe: false,
};

/** Operations on mail routing rules under a single account. */
export class RoutingApi {
  readonly #request: Requester;

  /**
   * @param request - The client's bound request executor.
   */
  public constructor(request: Requester) {
    this.#request = request;
  }

  /**
   * List all routing rules active under the account.
   *
   * @param options - Per-call overrides.
   * @returns The routing rules (each with its numeric `id`).
   */
  public list(options?: CallOptions): Promise<ListRoutingResult> {
    return this.#request(LIST, {}, options);
  }

  /**
   * Create a routing rule for a domain.
   *
   * @param input - Rule definition (domain, prefix flag, matchUser, targets).
   * @param options - Per-call overrides.
   * @returns An empty result on success.
   */
  public create(input: CreateRoutingRuleInput, options?: CallOptions): Promise<EmptyResult> {
    return this.#request(CREATE, input, options);
  }

  /**
   * Delete a routing rule by its id (from {@link RoutingApi.list}).
   *
   * @param input - The `routingRuleId` to delete.
   * @param options - Per-call overrides.
   * @returns An empty result on success.
   */
  public delete(input: DeleteRoutingRuleInput, options?: CallOptions): Promise<EmptyResult> {
    return this.#request(DELETE, input, options);
  }
}
