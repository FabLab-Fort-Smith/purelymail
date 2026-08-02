/** Test helpers: fake transport + response builders. Not a test suite. */
import type { HttpRequest, HttpResponse, HttpTransport } from '../src/http/transport.js';

/** Records every request and returns queued/handler responses. */
export class FakeTransport implements HttpTransport {
  public readonly requests: HttpRequest[] = [];
  #handler: (req: HttpRequest, callIndex: number) => HttpResponse | Promise<HttpResponse>;

  public constructor(
    handler: (req: HttpRequest, callIndex: number) => HttpResponse | Promise<HttpResponse>,
  ) {
    this.#handler = handler;
  }

  public async send(request: HttpRequest): Promise<HttpResponse> {
    const index = this.requests.length;
    this.requests.push(request);
    return this.#handler(request, index);
  }
}

/** Build a JSON HTTP response. */
export function jsonResponse(
  status: number,
  body: unknown,
  headers: Record<string, string> = {},
): HttpResponse {
  return { status, headers, body: typeof body === 'string' ? body : JSON.stringify(body) };
}

/** A success envelope `{ type: "success", result }`. */
export function success(status: number, result: unknown): HttpResponse {
  return jsonResponse(status, { type: 'success', result });
}
