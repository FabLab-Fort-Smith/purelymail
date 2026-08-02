/**
 * Token provider port and built-in implementations.
 *
 * The client obtains its API token through this port, never from a hard-coded
 * value or a constructor string it stores long-term. This keeps secret sourcing
 * pluggable — env var (default), a static value, or a downstream keychain/vault
 * adapter — per workflow-secrets and the extensibility goal.
 *
 * @packageDocumentation
 */

import { PurelymailConfigError } from '../errors.js';

/**
 * Read `process.env` if running under Node, else an empty map.
 *
 * @returns The environment variable map.
 */
function readProcessEnv(): Record<string, string | undefined> {
  const proc = (globalThis as { process?: { env?: Record<string, string | undefined> } }).process;
  /* v8 ignore next -- defensive fallback for non-Node hosts (e.g. browsers) */
  return proc?.env ?? {};
}

/**
 * Supplies the PurelyMail API token on demand.
 *
 * Implementations should fetch lazily (so a token can rotate between calls) and
 * MUST throw {@link PurelymailConfigError} when no token is available.
 */
export interface TokenProvider {
  /**
   * Resolve the current token.
   *
   * @returns The raw API token (never logged by the client).
   */
  getToken(): Promise<string>;

  /**
   * A short, secret-free description of where the token comes from, for
   * diagnostics (e.g. `"env:PURELYMAIL_API_TOKEN"`).
   *
   * @returns A redaction-safe source label.
   */
  describe(): string;
}

/**
 * A provider that returns a token held in memory. Universal (no Node APIs);
 * useful for tests and for callers that already resolved the secret themselves.
 */
export class StaticTokenProvider implements TokenProvider {
  readonly #token: string;

  /**
   * @param token - The API token. Must be non-empty.
   */
  public constructor(token: string) {
    if (typeof token !== 'string' || token.trim() === '') {
      throw new PurelymailConfigError('StaticTokenProvider requires a non-empty token.');
    }
    this.#token = token;
  }

  /** @inheritDoc */
  public getToken(): Promise<string> {
    return Promise.resolve(this.#token);
  }

  /** @inheritDoc */
  public describe(): string {
    return 'static';
  }
}

/**
 * Reads the token from a process environment variable (default
 * `PURELYMAIL_API_TOKEN`). Node-oriented; resolves lazily so rotation is picked
 * up on the next call.
 */
export class EnvTokenProvider implements TokenProvider {
  readonly #varName: string;
  readonly #env: Record<string, string | undefined>;

  /**
   * @param options - Environment variable `varName` and optional `env` source
   *   (defaults to `process.env`).
   */
  public constructor(options?: { varName?: string; env?: Record<string, string | undefined> }) {
    this.#varName = options?.varName ?? 'PURELYMAIL_API_TOKEN';
    this.#env = options?.env ?? readProcessEnv();
  }

  /** @inheritDoc */
  public getToken(): Promise<string> {
    const value = this.#env[this.#varName];
    if (typeof value !== 'string' || value.trim() === '') {
      return Promise.reject(
        new PurelymailConfigError(
          `Environment variable ${this.#varName} is not set or empty; ` +
            'export your PurelyMail API token there.',
        ),
      );
    }
    return Promise.resolve(value);
  }

  /** @inheritDoc */
  public describe(): string {
    return `env:${this.#varName}`;
  }
}
