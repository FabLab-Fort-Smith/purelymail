/** CLI test helpers. Not a test suite. */
import {
  PurelymailClient,
  ProfileRegistry,
  StaticTokenProvider,
  type HttpResponse,
  type Profile,
} from '@fablabfortsmith/purelymail-core';
import type { IO } from '../src/output.js';

/** Build a capturing IO object (functions bound). */
export function capture(): { io: IO; out: string[]; errs: string[] } {
  const out: string[] = [];
  const errs: string[] = [];
  return {
    io: { out: (l) => out.push(l), err: (l) => errs.push(l) },
    out,
    errs,
  };
}

const tp = new StaticTokenProvider('t-123456');

/** Build a profile with an optional org. */
export function profile(name: string, org?: string): Profile {
  return org === undefined ? { name, tokenProvider: tp } : { name, org, tokenProvider: tp };
}

/** A registry from (name, org) pairs. */
export function registry(pairs: [string, string?][]): ProfileRegistry {
  return new ProfileRegistry(pairs.map(([n, o]) => profile(n, o)));
}

/**
 * Client factory whose transport answers via `responder(profileName, path)`.
 * Return an HttpResponse; default success `{}`.
 */
export function clientFactory(
  responder: (profileName: string, path: string, body: unknown) => HttpResponse,
): (p: Profile) => PurelymailClient {
  return (p) =>
    new PurelymailClient({
      token: 't-123456',
      transport: {
        send: (req) => {
          const path = new URL(req.url).pathname.split('/').pop() ?? '';
          return Promise.resolve(responder(p.name, path, JSON.parse(req.body)));
        },
      },
    });
}

/** Success envelope helper. */
export function ok(result: unknown): HttpResponse {
  return { status: 200, headers: {}, body: JSON.stringify({ type: 'success', result }) };
}

/** Error response helper. */
export function apiError(status: number, code: string, message: string): HttpResponse {
  return { status, headers: {}, body: JSON.stringify({ type: 'error', code, message }) };
}
