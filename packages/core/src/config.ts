/**
 * Client configuration and resolution.
 *
 * Applies secure defaults (HTTPS-only base URL, bounded timeout) and wires the
 * injectable ports (transport, token provider, logger, retry policy). Invalid
 * configuration fails closed with {@link PurelymailConfigError}.
 *
 * @packageDocumentation
 */

import {
  EnvTokenProvider,
  StaticTokenProvider,
  type TokenProvider,
} from './auth/token-provider.js';
import { PurelymailConfigError } from './errors.js';
import { FetchTransport, type FetchLike } from './http/fetch-transport.js';
import type { HttpTransport } from './http/transport.js';
import { NoopLogger, type Logger } from './logging/logger.js';
import { DEFAULT_RETRY_POLICY, type RetryPolicy } from './retry.js';

/** Canonical production base URL. */
export const DEFAULT_BASE_URL = 'https://purelymail.com';

/** Path prefix for all v0 endpoints. */
export const API_PREFIX = '/api/v0';

/** Default per-request timeout. */
export const DEFAULT_TIMEOUT_MS = 30_000;

/** Library version, embedded in the default `User-Agent`. Keep in sync with package.json. */
export const LIB_VERSION = '0.2.0';

/** Options accepted by the {@link PurelymailClient} constructor. */
export interface PurelymailClientOptions {
  /** Explicit token provider (highest precedence). */
  readonly tokenProvider?: TokenProvider;
  /** Convenience: a literal token, wrapped in a {@link StaticTokenProvider}. */
  readonly token?: string;
  /** Override base URL. Must be `https:` (fails closed otherwise). */
  readonly baseUrl?: string;
  /** Per-request timeout in milliseconds (must be > 0). */
  readonly timeoutMs?: number;
  /** Inject a custom transport (defaults to {@link FetchTransport}). */
  readonly transport?: HttpTransport;
  /** Convenience: a custom `fetch` used to build the default transport. */
  readonly fetch?: FetchLike;
  /** Optional logger (defaults to {@link NoopLogger}). */
  readonly logger?: Logger;
  /** Retry policy for safe operations (defaults to {@link DEFAULT_RETRY_POLICY}). */
  readonly retryPolicy?: RetryPolicy;
  /** Override the `User-Agent`. */
  readonly userAgent?: string;
}

/** Fully-resolved, validated configuration used internally. */
export interface ResolvedClientConfig {
  /** Base URL without a trailing slash. */
  readonly baseUrl: string;
  /** Per-request timeout in milliseconds. */
  readonly timeoutMs: number;
  /** The transport to use. */
  readonly transport: HttpTransport;
  /** The token provider to use. */
  readonly tokenProvider: TokenProvider;
  /** The logger to use. */
  readonly logger: Logger;
  /** The retry policy to use. */
  readonly retryPolicy: RetryPolicy;
  /** The `User-Agent` header value. */
  readonly userAgent: string;
}

/**
 * Validate and resolve client options into a complete configuration.
 *
 * @param options - Raw constructor options.
 * @returns A validated {@link ResolvedClientConfig}.
 * @throws {@link PurelymailConfigError} on an invalid base URL or timeout.
 */
export function resolveConfig(options: PurelymailClientOptions = {}): ResolvedClientConfig {
  const baseUrl = normalizeBaseUrl(options.baseUrl ?? DEFAULT_BASE_URL);

  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    throw new PurelymailConfigError(
      `timeoutMs must be a positive number, got ${String(timeoutMs)}`,
    );
  }

  const tokenProvider = resolveTokenProvider(options);

  const transport =
    options.transport ?? new FetchTransport(options.fetch ? { fetch: options.fetch } : undefined);

  return {
    baseUrl,
    timeoutMs,
    transport,
    tokenProvider,
    logger: options.logger ?? new NoopLogger(),
    retryPolicy: options.retryPolicy ?? DEFAULT_RETRY_POLICY,
    userAgent: options.userAgent ?? `@fablabfortsmith/purelymail-core/${LIB_VERSION}`,
  };
}

/**
 * Choose the token provider by precedence: explicit provider, then a literal
 * token, then the default environment variable.
 *
 * @param options - Raw options.
 * @returns The resolved {@link TokenProvider}.
 */
function resolveTokenProvider(options: PurelymailClientOptions): TokenProvider {
  if (options.tokenProvider) {
    return options.tokenProvider;
  }
  if (options.token !== undefined) {
    return new StaticTokenProvider(options.token);
  }
  return new EnvTokenProvider();
}

/**
 * Enforce an HTTPS base URL and strip any trailing slash.
 *
 * @param raw - Candidate base URL.
 * @returns A normalized base URL.
 * @throws {@link PurelymailConfigError} if not a valid `https:` URL.
 */
function normalizeBaseUrl(raw: string): string {
  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch (cause) {
    throw new PurelymailConfigError(`Invalid base URL: ${raw}`, { cause });
  }
  if (parsed.protocol !== 'https:') {
    // No plaintext transport (master §5). For local mocks, inject a transport instead.
    throw new PurelymailConfigError(
      `Base URL must use https (got "${parsed.protocol}//"). ` +
        'For local testing, inject a custom `transport` rather than using http.',
    );
  }
  return raw.replace(/\/+$/, '');
}
