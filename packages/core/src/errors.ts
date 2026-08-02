/**
 * Typed error hierarchy for the PurelyMail client.
 *
 * Errors are modelled as values with a stable, machine-readable shape so callers
 * (a CLI, a web backend) can branch on failure kind without string-matching, and
 * so internal detail never leaks unredacted (see topic-error-handling, master §5).
 *
 * @packageDocumentation
 */

/**
 * Base class for every error thrown by this library.
 *
 * All subclasses set a distinct {@link PurelymailError.name} and are safe to
 * surface to users: they never embed the API token or other secrets.
 */
export class PurelymailError extends Error {
  /** Stable discriminator matching the subclass, e.g. `"PurelymailApiError"`. */
  public override readonly name: string = 'PurelymailError';

  /**
   * @param message - Human-readable, secret-free description.
   * @param options - Standard error options (supports `cause`).
   */
  public constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    // Restore prototype chain for reliable `instanceof` across transpile targets.
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

/**
 * Invalid or missing configuration: absent token, non-HTTPS base URL, or a
 * malformed profile. Thrown before any network call. Fails closed.
 */
export class PurelymailConfigError extends PurelymailError {
  public override readonly name = 'PurelymailConfigError';
}

/**
 * A request payload failed local schema validation, or a response from the API
 * did not match the expected schema (an untrusted upstream returning an
 * unexpected shape). Carries the human-readable validation issues.
 */
export class PurelymailValidationError extends PurelymailError {
  public override readonly name = 'PurelymailValidationError';

  /** Whether the failure was in the outgoing `request` or incoming `response`. */
  public readonly phase: 'request' | 'response';

  /** Flat, secret-free list of validation problems. */
  public readonly issues: readonly string[];

  /**
   * @param phase - Which side of the exchange failed validation.
   * @param issues - Secret-free descriptions of each problem.
   * @param options - Standard error options (supports `cause`).
   */
  public constructor(
    phase: 'request' | 'response',
    issues: readonly string[],
    options?: { cause?: unknown },
  ) {
    super(`PurelyMail ${phase} validation failed: ${issues.join('; ')}`, options);
    this.phase = phase;
    this.issues = issues;
  }
}

/**
 * A transport-level failure: DNS/connection error, TLS failure, timeout, or an
 * unreadable/non-JSON response body. No HTTP status is available (or the body
 * was unusable). Retryable transient failures are represented here.
 */
export class PurelymailTransportError extends PurelymailError {
  public override readonly name = 'PurelymailTransportError';

  /** True when the failure was a client-side timeout/abort. */
  public readonly timeout: boolean;

  /**
   * @param message - Secret-free description.
   * @param options - Options; set `timeout` when the request was aborted.
   */
  public constructor(message: string, options?: { cause?: unknown; timeout?: boolean }) {
    super(message, options);
    this.timeout = options?.timeout ?? false;
  }
}

/**
 * The API responded with an error envelope (`{ type: "error", code, message }`)
 * or a non-success HTTP status. Carries the provider's error `code` and the
 * HTTP status for programmatic handling.
 */
export class PurelymailApiError extends PurelymailError {
  public override readonly name: string = 'PurelymailApiError';

  /** Provider-supplied error code (e.g. `"INVALID_TOKEN"`), or `undefined`. */
  public readonly code: string | undefined;

  /** HTTP status code of the response, or `undefined` if not available. */
  public readonly httpStatus: number | undefined;

  /**
   * @param message - Provider message (already secret-free).
   * @param details - Provider `code` and HTTP `status`.
   * @param options - Standard error options (supports `cause`).
   */
  public constructor(
    message: string,
    details: { code?: string | undefined; httpStatus?: number | undefined } = {},
    options?: { cause?: unknown },
  ) {
    super(message, options);
    this.code = details.code;
    this.httpStatus = details.httpStatus;
  }
}

/**
 * Authentication/authorization failure — an invalid, revoked, or unauthorized
 * token. A specialization of {@link PurelymailApiError} (HTTP 401/403 or an
 * auth-class provider code) so callers can prompt for re-authentication.
 */
export class PurelymailAuthError extends PurelymailApiError {
  public override readonly name = 'PurelymailAuthError';
}
