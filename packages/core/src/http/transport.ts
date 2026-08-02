/**
 * HTTP transport port.
 *
 * The client depends only on this interface, not on `fetch`, so callers can
 * inject an instrumented, proxied, or in-memory transport (tests inject a fake;
 * a web backend might add tracing). See topic-architecture-patterns (ports).
 *
 * @packageDocumentation
 */

/** An outbound HTTP request. The PurelyMail API is JSON-over-POST only. */
export interface HttpRequest {
  /** Absolute, https URL. */
  readonly url: string;
  /** Always `POST` for this API. */
  readonly method: 'POST';
  /** Header map. Includes the auth header and content negotiation. */
  readonly headers: Readonly<Record<string, string>>;
  /** Serialized JSON request body. */
  readonly body: string;
  /** Per-request timeout in milliseconds; the transport MUST abort past it. */
  readonly timeoutMs: number;
  /** Optional caller cancellation signal, combined with the timeout. */
  readonly signal?: AbortSignal;
}

/** A raw HTTP response, body left unparsed for the client to interpret. */
export interface HttpResponse {
  /** HTTP status code. */
  readonly status: number;
  /** Lower-cased response headers. */
  readonly headers: Readonly<Record<string, string>>;
  /** Response body as text (may be empty). */
  readonly body: string;
}

/**
 * Sends an {@link HttpRequest} and resolves with an {@link HttpResponse}.
 *
 * Implementations MUST reject with a
 * {@link PurelymailTransportError} on network/timeout failures and MUST NOT
 * throw on non-2xx statuses (those are returned for the client to map).
 */
export interface HttpTransport {
  /**
   * Perform the request.
   *
   * @param request - The request to send.
   * @returns The raw response.
   */
  send(request: HttpRequest): Promise<HttpResponse>;
}
