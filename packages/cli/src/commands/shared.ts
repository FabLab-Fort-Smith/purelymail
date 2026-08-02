/**
 * Shared helpers for CLI commands: cross-account aggregation and rendering.
 *
 * @packageDocumentation
 */

import type { PurelymailClient } from '@fablabfortsmith/purelymail-core';
import type { CliContext } from '../context.js';
import { CliError, printJson, printTable, readStdin, type IO } from '../output.js';

/**
 * Resolve a secret (password / app password) from stdin or a named env var —
 * never from a plaintext flag (which would leak via shell history/`ps`).
 *
 * @param kind - Label used in error messages (e.g. `"password"`).
 * @param fromStdin - Read the trimmed value from standard input.
 * @param envVar - Name of an env var holding the value.
 * @param env - Environment map (defaults to `process.env`).
 * @returns The resolved secret.
 * @throws {@link CliError} when no source is provided or the env var is empty.
 */
export async function resolveSecret(
  kind: string,
  fromStdin: boolean | undefined,
  envVar: string | undefined,
  env: Record<string, string | undefined> = process.env,
): Promise<string> {
  if (fromStdin) {
    const value = await readStdin();
    if (value === '') {
      throw new CliError(`Empty ${kind} received on stdin.`, 2);
    }
    return value;
  }
  if (envVar !== undefined) {
    const value = env[envVar];
    if (value === undefined || value.trim() === '') {
      throw new CliError(`Env var ${envVar} for ${kind} is not set.`, 5);
    }
    return value;
  }
  throw new CliError(`Provide the ${kind} via --${kind}-stdin or --${kind}-env <VAR>.`, 2);
}

/**
 * Report a success (or arbitrary data) as JSON or a one-line message.
 *
 * @param ctx - The CLI context.
 * @param message - Human-readable success message.
 * @param data - Optional payload to print in JSON mode instead of `{ok,message}`.
 */
export function report(ctx: CliContext, message: string, data?: unknown): void {
  if (ctx.json) {
    printJson(ctx.io, data ?? { ok: true, message });
  } else {
    ctx.io.out(message);
  }
}

/** A row tagged with its source account/org. */
export type TaggedRow = Record<string, unknown> & { profile: string; org: string };

/** Aggregated rows plus per-account failures. */
export interface AggregateResult {
  /** Flattened, tagged rows across successful accounts. */
  readonly rows: TaggedRow[];
  /** Per-account failures (profile, org, message). */
  readonly failures: { profile: string; org: string; error: string }[];
}

/**
 * Run a read across the selected accounts and flatten the results into rows,
 * each tagged with its `profile`/`org`. Failures are captured, not thrown.
 *
 * @typeParam T - The per-item type returned by the operation.
 * @param ctx - The CLI context.
 * @param fetch - Operation returning an array for one account's client.
 * @param toRow - Map one item to display fields (profile/org are added).
 * @returns The aggregated rows and failures.
 */
export async function aggregate<T>(
  ctx: CliContext,
  fetch: (client: PurelymailClient) => Promise<readonly T[]>,
  toRow: (item: T) => Record<string, unknown>,
): Promise<AggregateResult> {
  const outcomes = await ctx.workspace().run(ctx.selectedProfiles(), (client) => fetch(client));
  const rows: TaggedRow[] = [];
  const failures: AggregateResult['failures'] = [];
  for (const outcome of outcomes) {
    const org = outcome.org ?? '';
    if (outcome.ok) {
      for (const item of outcome.value) {
        rows.push({ profile: outcome.profile, org, ...toRow(item) });
      }
    } else {
      failures.push({
        profile: outcome.profile,
        org,
        error: `${outcome.error.name}: ${outcome.error.message}`,
      });
    }
  }
  return { rows, failures };
}

/**
 * Emit an {@link AggregateResult} as JSON or a table, printing any failures to
 * stderr so partial failure is never hidden.
 *
 * @param io - Output sink.
 * @param json - Whether to emit JSON.
 * @param columns - Table columns (in order).
 * @param result - The aggregate result.
 */
export function emitAggregate(
  io: IO,
  json: boolean,
  columns: readonly string[],
  result: AggregateResult,
): void {
  if (json) {
    printJson(io, result);
  } else {
    printTable(io, result.rows, columns);
  }
  for (const failure of result.failures) {
    io.err(`error [${failure.profile}]: ${failure.error}`);
  }
}
