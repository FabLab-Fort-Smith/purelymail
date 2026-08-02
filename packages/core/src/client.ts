/**
 * {@link PurelymailClient} — the per-account API client.
 *
 * Wires the request pipeline (validate → authenticate → transport → envelope &
 * error mapping → response validation → bounded retry) and exposes grouped,
 * typed service namespaces. One client == one PurelyMail account/token; use a
 * {@link module:workspace.PurelymailWorkspace | PurelymailWorkspace} to work
 * across many.
 *
 * @packageDocumentation
 */

import {
  resolveConfig,
  API_PREFIX,
  type PurelymailClientOptions,
  type ResolvedClientConfig,
} from './config.js';
import {
  PurelymailApiError,
  PurelymailAuthError,
  PurelymailTransportError,
  PurelymailValidationError,
} from './errors.js';
import type { HttpResponse } from './http/transport.js';
import { createRedactor } from './logging/logger.js';
import type { CallOptions, OperationSpec, Requester } from './internal.js';
import { errorEnvelopeSchema } from './schemas.js';
import {
  backoffDelay,
  isRetryableStatus,
  parseRetryAfterMs,
  sleep,
  type RetryPolicy,
} from './retry.js';
import { AccountApi } from './services/account.js';
import { AppPasswordsApi } from './services/app-passwords.js';
import { DomainsApi } from './services/domains.js';
import { PasswordResetApi } from './services/password-reset.js';
import { RoutingApi } from './services/routing.js';
import { UsersApi } from './services/users.js';
import type { z } from 'zod';

/** Whether an HTTP status is a success (2xx). */
function isOk(status: number): boolean {
  return status >= 200 && status < 300;
}

/** Flatten Zod issues into secret-free strings. */
function formatIssues(error: z.ZodError): string[] {
  return error.issues.map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`);
}

/** Heuristic: does this response body / status represent an auth failure? */
function isAuthLike(status: number | undefined, code: string | undefined): boolean {
  if (status === 401 || status === 403) {
    return true;
  }
  return typeof code === 'string' && /token|auth|unauthor|forbidden|credential/i.test(code);
}

/** Does a parsed 2xx body look like an error envelope rather than a success? */
function isErrorShape(data: unknown): data is Record<string, unknown> {
  if (data === null || typeof data !== 'object') {
    return false;
  }
  const obj = data as Record<string, unknown>;
  if (obj['type'] === 'error') {
    return true;
  }
  if (obj['type'] === 'success') {
    return false;
  }
  return (
    !('result' in obj) && (typeof obj['code'] === 'string' || typeof obj['message'] === 'string')
  );
}

/**
 * The PurelyMail API client for a single account.
 *
 * @example
 * ```ts
 * const client = new PurelymailClient(); // token from PURELYMAIL_API_TOKEN
 * const { domains } = await client.domains.list();
 * ```
 */
export class PurelymailClient {
  readonly #config: ResolvedClientConfig;

  /** Domain operations. */
  public readonly domains: DomainsApi;
  /** User/mailbox operations. */
  public readonly users: UsersApi;
  /** Routing-rule operations. */
  public readonly routing: RoutingApi;
  /** Password-reset (recovery) method operations. */
  public readonly passwordResets: PasswordResetApi;
  /** App-password operations. */
  public readonly appPasswords: AppPasswordsApi;
  /** Account-level operations. */
  public readonly account: AccountApi;

  /**
   * @param options - Client configuration (token source, base URL, transport…).
   */
  public constructor(options: PurelymailClientOptions = {}) {
    this.#config = resolveConfig(options);
    const request: Requester = (spec, input, callOptions) =>
      this.#execute(spec, input, callOptions);
    this.domains = new DomainsApi(request);
    this.users = new UsersApi(request);
    this.routing = new RoutingApi(request);
    this.passwordResets = new PasswordResetApi(request);
    this.appPasswords = new AppPasswordsApi(request);
    this.account = new AccountApi(request);
  }

  /**
   * Low-level escape hatch: execute an arbitrary {@link OperationSpec}. Lets
   * consumers call new/undocumented endpoints without waiting for a wrapper.
   *
   * @typeParam TResult - The parsed result type.
   * @param spec - The operation definition.
   * @param input - The request payload (validated by `spec.requestSchema`).
   * @param options - Per-call overrides.
   * @returns The validated result.
   */
  public request<TResult>(
    spec: OperationSpec<TResult>,
    input: unknown,
    options?: CallOptions,
  ): Promise<TResult> {
    return this.#execute(spec, input, options);
  }

  async #execute<TResult>(
    spec: OperationSpec<TResult>,
    input: unknown,
    callOptions?: CallOptions,
  ): Promise<TResult> {
    const parsed = spec.requestSchema.safeParse(input);
    if (!parsed.success) {
      throw new PurelymailValidationError('request', formatIssues(parsed.error));
    }

    const token = await this.#config.tokenProvider.getToken();
    const redact = createRedactor([token]);
    const url = `${this.#config.baseUrl}${API_PREFIX}/${spec.path}`;
    const headers: Record<string, string> = {
      'Purelymail-Api-Token': token,
      'Content-Type': 'application/json',
      Accept: 'application/json',
      'User-Agent': this.#config.userAgent,
    };
    const body = JSON.stringify(parsed.data);
    const timeoutMs = callOptions?.timeoutMs ?? this.#config.timeoutMs;
    const retryEnabled = callOptions?.retry ?? spec.safe;
    const maxRetries = retryEnabled ? this.#config.retryPolicy.maxRetries : 0;
    const policy: RetryPolicy = this.#config.retryPolicy;

    let attempt = 0;
    for (;;) {
      this.#config.logger.log('debug', 'purelymail request', {
        operation: spec.path,
        attempt,
      });

      let response: HttpResponse;
      try {
        response = await this.#config.transport.send({
          url,
          method: 'POST',
          headers,
          body,
          timeoutMs,
          ...(callOptions?.signal ? { signal: callOptions.signal } : {}),
        });
      } catch (err) {
        if (err instanceof PurelymailTransportError && attempt < maxRetries) {
          await this.#waitBackoff(policy, attempt, undefined, callOptions?.signal);
          attempt += 1;
          continue;
        }
        throw err;
      }

      if (!isOk(response.status)) {
        if (isRetryableStatus(response.status) && attempt < maxRetries) {
          const retryAfterMs = parseRetryAfterMs(response.headers['retry-after']);
          await this.#waitBackoff(policy, attempt, retryAfterMs, callOptions?.signal);
          attempt += 1;
          continue;
        }
        throw this.#toApiError(response, redact);
      }

      const data = this.#parseJson(response.body);
      if (isErrorShape(data)) {
        throw this.#buildApiError(response.status, data, redact);
      }
      const result = this.#extractResult(data);
      const validated = spec.resultSchema.safeParse(result);
      if (!validated.success) {
        throw new PurelymailValidationError('response', formatIssues(validated.error));
      }
      return validated.data;
    }
  }

  async #waitBackoff(
    policy: RetryPolicy,
    attempt: number,
    retryAfterMs: number | undefined,
    signal: AbortSignal | undefined,
  ): Promise<void> {
    const delay = backoffDelay(attempt + 1, policy, { retryAfterMs });
    try {
      await sleep(delay, signal);
    } catch {
      throw new PurelymailTransportError('Request was cancelled during retry backoff', {
        timeout: false,
      });
    }
  }

  #parseJson(bodyText: string): unknown {
    const trimmed = bodyText.trim();
    if (trimmed === '') {
      return {};
    }
    try {
      return JSON.parse(trimmed);
    } catch (cause) {
      throw new PurelymailTransportError('Received a non-JSON response from the API', { cause });
    }
  }

  #extractResult(data: unknown): unknown {
    if (data !== null && typeof data === 'object') {
      const obj = data as Record<string, unknown>;
      if ('result' in obj) {
        return obj['result'];
      }
      if (obj['type'] === 'success' || Object.keys(obj).length === 0) {
        return {};
      }
    }
    throw new PurelymailValidationError('response', ['response missing "result" field']);
  }

  #toApiError(response: HttpResponse, redact: (s: string) => string): PurelymailApiError {
    let code: string | undefined;
    let message: string | undefined;
    const trimmed = response.body.trim();
    if (trimmed !== '') {
      try {
        const env = errorEnvelopeSchema.safeParse(JSON.parse(trimmed));
        if (env.success) {
          code = env.data.code;
          message = env.data.message;
        }
      } catch {
        // non-JSON error body; fall through to status-based message
      }
    }
    return this.#makeApiError(response.status, code, message, redact);
  }

  #buildApiError(
    status: number,
    data: Record<string, unknown>,
    redact: (s: string) => string,
  ): PurelymailApiError {
    const env = errorEnvelopeSchema.safeParse(data);
    const code = env.success ? env.data.code : undefined;
    const message = env.success ? env.data.message : undefined;
    return this.#makeApiError(status, code, message, redact);
  }

  #makeApiError(
    status: number,
    code: string | undefined,
    message: string | undefined,
    redact: (s: string) => string,
  ): PurelymailApiError {
    const safeMessage = redact(message ?? `PurelyMail API request failed with HTTP ${status}`);
    const details = { code, httpStatus: status };
    if (isAuthLike(status, code)) {
      return new PurelymailAuthError(safeMessage, details);
    }
    return new PurelymailApiError(safeMessage, details);
  }
}
