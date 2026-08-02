/**
 * CLI output, prompting, and error/exit-code helpers.
 *
 * Keeps all terminal I/O behind a small {@link IO} seam so commands stay pure
 * and testable (dependency injection). Destructive prompts fail closed in a
 * non-interactive shell unless `--yes` is given (workflow-gated-actions).
 *
 * @packageDocumentation
 */

import { createInterface } from 'node:readline/promises';
import { Readable } from 'node:stream';
import {
  PurelymailApiError,
  PurelymailAuthError,
  PurelymailConfigError,
  PurelymailError,
  PurelymailTransportError,
  PurelymailValidationError,
} from '@fablabfortsmith/purelymail-core';

/** Output sink seam (stdout/stderr), injectable for tests. */
export interface IO {
  /** Write a line to standard output. */
  out(line: string): void;
  /** Write a line to standard error. */
  err(line: string): void;
}

/** Default {@link IO} bound to the process streams. */
export const stdio: IO = {
  out: (line) => process.stdout.write(`${line}\n`),
  err: (line) => process.stderr.write(`${line}\n`),
};

/** A CLI-level error carrying a stable process exit code. */
export class CliError extends Error {
  public override readonly name = 'CliError';
  /** Process exit code to use. */
  public readonly exitCode: number;

  /**
   * @param message - User-facing message.
   * @param exitCode - Exit code (default 1).
   */
  public constructor(message: string, exitCode = 1) {
    super(message);
    this.exitCode = exitCode;
  }
}

/**
 * Map any thrown error to a stable exit code.
 *
 * @param error - The caught error.
 * @returns The process exit code.
 */
export function exitCodeFor(error: unknown): number {
  if (error instanceof CliError) {
    return error.exitCode;
  }
  if (error instanceof PurelymailValidationError) {
    return 2;
  }
  if (error instanceof PurelymailAuthError) {
    return 3;
  }
  if (error instanceof PurelymailApiError) {
    return 4;
  }
  if (error instanceof PurelymailConfigError) {
    return 5;
  }
  if (error instanceof PurelymailTransportError) {
    return 6;
  }
  return 1;
}

/**
 * Produce a concise, user-facing message for an error.
 *
 * @param error - The caught error.
 * @returns A single-line message (already secret-free from the core).
 */
export function messageFor(error: unknown): string {
  if (error instanceof PurelymailError || error instanceof CliError) {
    return `${error.name}: ${error.message}`;
  }
  if (error instanceof Error) {
    return error.message;
  }
  return String(error);
}

/**
 * Print data as pretty JSON.
 *
 * @param io - Output sink.
 * @param data - Serializable data.
 */
export function printJson(io: IO, data: unknown): void {
  io.out(JSON.stringify(data, null, 2));
}

/**
 * Print an array of records as a simple aligned table.
 *
 * @param io - Output sink.
 * @param rows - The records.
 * @param columns - Ordered column keys to display.
 */
export function printTable(
  io: IO,
  rows: readonly Record<string, unknown>[],
  columns: readonly string[],
): void {
  if (rows.length === 0) {
    io.err('(no results)');
    return;
  }
  const widths = columns.map((c) => Math.max(c.length, ...rows.map((r) => cell(r[c]).length)));
  const line = (cells: readonly string[]): string =>
    cells.map((value, i) => value.padEnd(widths[i]!)).join('  ');
  io.out(line(columns));
  io.out(line(widths.map((w) => '-'.repeat(w))));
  for (const row of rows) {
    io.out(line(columns.map((c) => cell(row[c]))));
  }
}

/** Stringify a table cell value safely (objects become JSON). */
function cell(value: unknown): string {
  if (value === null || value === undefined) {
    return '';
  }
  if (typeof value === 'object') {
    return JSON.stringify(value);
  }
  // eslint-disable-next-line @typescript-eslint/no-base-to-string -- primitive only here
  return String(value);
}

/**
 * Render a result either as JSON or via a table renderer.
 *
 * @param io - Output sink.
 * @param json - Whether to emit JSON.
 * @param data - The data to print as JSON.
 * @param renderTable - Fallback human renderer when not JSON.
 */
export function render(io: IO, json: boolean, data: unknown, renderTable: (io: IO) => void): void {
  if (json) {
    printJson(io, data);
  } else {
    renderTable(io);
  }
}

/**
 * Ask for confirmation of a destructive action.
 *
 * @param message - The prompt (a yes/no question).
 * @param assumeYes - When true, skip the prompt and proceed.
 * @param options - Injectable `input` stream and `isTty` flag for tests.
 * @returns Whether the user confirmed.
 * @throws {@link CliError} in a non-interactive shell without `--yes`.
 */
export async function confirm(
  message: string,
  assumeYes: boolean,
  options?: { input?: NodeJS.ReadableStream; output?: NodeJS.WritableStream; isTty?: boolean },
): Promise<boolean> {
  if (assumeYes) {
    return true;
  }
  const isTty = options?.isTty ?? Boolean(process.stdin.isTTY);
  if (!isTty) {
    throw new CliError(
      `Refusing to run a destructive action without confirmation. Re-run with --yes. (${message})`,
      7,
    );
  }
  const rl = createInterface({
    input: options?.input ?? process.stdin,
    output: options?.output ?? process.stdout,
  });
  try {
    const answer = (await rl.question(`${message} [y/N] `)).trim().toLowerCase();
    return answer === 'y' || answer === 'yes';
  } finally {
    rl.close();
  }
}

/**
 * Print a single record as aligned `key: value` lines.
 *
 * @param io - Output sink.
 * @param record - The record to print.
 */
export function printRecord(io: IO, record: Record<string, unknown>): void {
  const keys = Object.keys(record);
  const width = Math.max(0, ...keys.map((k) => k.length));
  for (const key of keys) {
    io.out(`${key.padEnd(width)}  ${JSON.stringify(record[key])}`);
  }
}

/**
 * Read all of standard input as a trimmed string (for `--password-stdin`).
 *
 * @param input - Injectable input stream (defaults to `process.stdin`).
 * @returns The trimmed input.
 */
export async function readStdin(input: NodeJS.ReadableStream = process.stdin): Promise<string> {
  const chunks: Buffer[] = [];
  const stream = input instanceof Readable ? input : Readable.from(input);
  for await (const chunk of stream) {
    chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk)));
  }
  return Buffer.concat(chunks).toString('utf8').trim();
}
