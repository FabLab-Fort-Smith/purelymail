/**
 * Internal contracts shared between the client and its service namespaces.
 *
 * Kept in a leaf module so services depend on these types without importing the
 * client (avoiding an import cycle). Not part of the public API surface beyond
 * the exported {@link CallOptions}.
 *
 * @packageDocumentation
 */

import type { z } from 'zod';

/**
 * Describes one API operation: its path, the schema that validates/serializes
 * the request, the schema that validates the response `result`, and whether it
 * is safe to auto-retry (idempotent read).
 *
 * @typeParam TResult - The parsed result type.
 */
export interface OperationSpec<TResult> {
  /** Operation path segment under `/api/v0`, e.g. `"createUser"`. */
  readonly path: string;
  /** Validates and applies defaults to the request payload. */
  readonly requestSchema: z.ZodTypeAny;
  /** Validates the response `result` payload. */
  readonly resultSchema: z.ZodType<TResult>;
  /** Whether the operation is a safe/idempotent read (auto-retry eligible). */
  readonly safe: boolean;
}

/** Per-call overrides. */
export interface CallOptions {
  /** Cancellation signal for this call. */
  readonly signal?: AbortSignal;
  /** Override the client timeout for this call (ms). */
  readonly timeoutMs?: number;
  /**
   * Force-enable or disable retrying for this call, overriding the operation's
   * default `safe` policy. Enabling retry on a mutating call is at the caller's
   * risk (not idempotent).
   */
  readonly retry?: boolean;
}

/**
 * The bound request executor a client hands to each service namespace.
 *
 * @typeParam TResult - The parsed result type for the operation.
 */
export type Requester = <TResult>(
  spec: OperationSpec<TResult>,
  input: unknown,
  options?: CallOptions,
) => Promise<TResult>;
