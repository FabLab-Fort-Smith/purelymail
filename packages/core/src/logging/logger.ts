/**
 * Logging port and secret-redacting helpers.
 *
 * The library never logs on its own; a caller may inject a {@link Logger} to
 * observe requests. All built-in loggers run values through a redactor so a
 * token can never reach a log sink (master §5, topic-logging-observability).
 *
 * @packageDocumentation
 */

/** Severity levels, ascending. */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Structured logging sink. Implement to route library diagnostics into your own
 * observability stack. `fields` is arbitrary structured context and MUST already
 * be free of secrets on the caller's side; built-in loggers additionally redact.
 */
export interface Logger {
  /**
   * Emit a log record.
   *
   * @param level - Severity.
   * @param message - Human-readable message.
   * @param fields - Optional structured context.
   */
  log(level: LogLevel, message: string, fields?: Record<string, unknown>): void;
}

/**
 * Build a redactor that masks each provided secret wherever it appears in a
 * string. Empty/short secrets are ignored to avoid masking innocuous text.
 *
 * @param secrets - Raw secret values to mask (e.g. the API token).
 * @returns A function replacing every occurrence with `«redacted»`.
 */
export function createRedactor(secrets: readonly string[]): (input: string) => string {
  const targets = secrets.filter((s): s is string => typeof s === 'string' && s.length >= 6);
  if (targets.length === 0) {
    return (input) => input;
  }
  return (input) => {
    let out = input;
    for (const secret of targets) {
      out = out.split(secret).join('«redacted»');
    }
    return out;
  };
}

/**
 * A {@link Logger} that discards everything. The default, so the library is
 * silent unless a caller opts in.
 */
export class NoopLogger implements Logger {
  /** @inheritDoc */
  public log(_level: LogLevel, _message: string, _fields?: Record<string, unknown>): void {
    // intentionally empty
  }
}

/**
 * A {@link Logger} that writes redacted JSON lines to a sink (defaults to
 * `console.error`), suitable for a CLI or simple service.
 */
export class ConsoleLogger implements Logger {
  readonly #redact: (input: string) => string;
  readonly #sink: (line: string) => void;
  readonly #minLevel: LogLevel;

  static readonly #order: Record<LogLevel, number> = { debug: 10, info: 20, warn: 30, error: 40 };

  /**
   * @param options - `secrets` to redact, minimum `level`, and an output `sink`.
   */
  public constructor(options?: {
    secrets?: readonly string[];
    level?: LogLevel;
    sink?: (line: string) => void;
  }) {
    this.#redact = createRedactor(options?.secrets ?? []);
    this.#sink = options?.sink ?? ((line) => console.error(line));
    this.#minLevel = options?.level ?? 'info';
  }

  /** @inheritDoc */
  public log(level: LogLevel, message: string, fields?: Record<string, unknown>): void {
    if (ConsoleLogger.#order[level] < ConsoleLogger.#order[this.#minLevel]) {
      return;
    }
    const record = { level, message, ...(fields ?? {}) };
    this.#sink(this.#redact(JSON.stringify(record)));
  }
}
