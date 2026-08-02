/**
 * Minimal interactive prompt helpers built on `node:readline/promises`.
 *
 * A single {@link Prompter} wraps one readline interface for a whole wizard so
 * sequential questions read from the same input stream. Secret entry mutes the
 * terminal echo. Injectable streams make the wizard fully testable.
 *
 * @packageDocumentation
 */

import { createInterface, type Interface } from 'node:readline/promises';

/** Injectable I/O for prompting. */
export interface PromptIO {
  /** Input stream (defaults to `process.stdin`). */
  readonly input: NodeJS.ReadableStream;
  /** Output stream (defaults to `process.stdout`). */
  readonly output: NodeJS.WritableStream;
  /** Whether the input is an interactive TTY (drives echo/masking). */
  readonly isTty: boolean;
}

/** A choice for {@link Prompter.askChoice}. */
export interface Choice<T> {
  /** Text shown to the user. */
  readonly label: string;
  /** Value returned when selected. */
  readonly value: T;
}

/** Sequential prompt helper over a single readline interface. */
export class Prompter {
  readonly #rl: Interface;
  readonly #io: PromptIO;
  readonly #terminal: boolean;

  /**
   * @param rl - The readline interface to use.
   * @param io - The prompt I/O.
   * @param terminal - Whether the input is a real terminal (drives echo masking).
   */
  public constructor(rl: Interface, io: PromptIO, terminal: boolean) {
    this.#rl = rl;
    this.#io = io;
    this.#terminal = terminal;
  }

  /**
   * Ask a free-text question, with an optional default and required check.
   *
   * @param question - The prompt text.
   * @param options - `default` value and whether the answer is `required`.
   * @returns The trimmed answer (or the default).
   */
  public async ask(
    question: string,
    options?: { default?: string; required?: boolean },
  ): Promise<string> {
    const suffix = options?.default ? ` [${options.default}]` : '';
    for (;;) {
      const raw = (await this.#rl.question(`${question}${suffix}: `)).trim();
      const value = raw === '' ? (options?.default ?? '') : raw;
      if (value === '' && options?.required) {
        this.#io.output.write('  (required)\n');
        continue;
      }
      return value;
    }
  }

  /**
   * Ask for a secret without echoing it to the terminal.
   *
   * @param question - The prompt text.
   * @returns The trimmed secret.
   */
  public async askSecret(question: string): Promise<string> {
    this.#io.output.write(`${question}: `);
    const iface = this.#rl as unknown as { _writeToOutput?: (s: string) => void };
    const original = iface._writeToOutput;
    /* v8 ignore start -- TTY echo suppression; only reachable on an interactive TTY */
    if (this.#terminal && original) {
      iface._writeToOutput = (): void => undefined;
    }
    /* v8 ignore stop */
    try {
      return (await this.#rl.question('')).trim();
    } finally {
      /* v8 ignore start -- restore TTY echo; TTY-only */
      if (this.#terminal && original) {
        iface._writeToOutput = original;
      }
      /* v8 ignore stop */
      this.#io.output.write('\n');
    }
  }

  /**
   * Ask a yes/no question.
   *
   * @param question - The prompt text.
   * @param def - Default when the user just presses enter.
   * @returns The boolean answer.
   */
  public async askYesNo(question: string, def = false): Promise<boolean> {
    const raw = (await this.#rl.question(`${question} ${def ? '[Y/n]' : '[y/N]'}: `))
      .trim()
      .toLowerCase();
    if (raw === '') {
      return def;
    }
    return raw === 'y' || raw === 'yes';
  }

  /**
   * Ask the user to pick from a numbered list.
   *
   * @typeParam T - The value type.
   * @param question - The prompt text.
   * @param choices - The choices.
   * @param def - Optional default value when the user presses enter.
   * @returns The chosen value.
   */
  public async askChoice<T>(question: string, choices: readonly Choice<T>[], def?: T): Promise<T> {
    this.#io.output.write(`${question}\n`);
    choices.forEach((c, i) => this.#io.output.write(`  ${i + 1}) ${c.label}\n`));
    for (;;) {
      const raw = (await this.#rl.question(`Select [1-${choices.length}]: `)).trim();
      if (raw === '' && def !== undefined) {
        return def;
      }
      const n = Number(raw);
      if (Number.isInteger(n) && n >= 1 && n <= choices.length) {
        return choices[n - 1]!.value;
      }
      this.#io.output.write('  invalid choice\n');
    }
  }

  /** Close the underlying readline interface. */
  public close(): void {
    this.#rl.close();
  }
}

/**
 * Create a {@link Prompter} over the given I/O.
 *
 * @param io - The prompt I/O.
 * @returns A ready prompter.
 */
export function createPrompter(io: PromptIO): Prompter {
  // `terminal` reflects the real input capability (drives line editing + echo),
  // independent of the caller's interactive-intent flag (`io.isTty`).
  const terminal = Boolean((io.input as { isTTY?: boolean }).isTTY);
  const rl = createInterface({ input: io.input, output: io.output, terminal });
  return new Prompter(rl, io, terminal);
}
