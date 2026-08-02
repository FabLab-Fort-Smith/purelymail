# ADR-0001: Hexagonal core + thin CLI, in a two-package workspace

- **Status:** Accepted
- **Date:** 2026-08-02

## Context

The goal is a PurelyMail management tool that is (a) usable from the terminal and
(b) reusable as a building block in other projects — notably a future web
application — and published for other contributors. PurelyMail's API is one
token per account with no server-side organization concept, yet the operator
administers domains across several organizations.

## Decision

1. **Two packages in a pnpm workspace.**
   - `@fablabfortsmith/purelymail-core` — framework-free client + domain logic.
     Runtime dependency: `zod` only; uses the platform `fetch`. This is the reuse
     surface a web backend imports without any CLI baggage.
   - `@fablabfortsmith/purelymail-cli` — a thin `commander` adapter over core.
2. **Ports & adapters (hexagonal).** Core depends on interfaces —
   `HttpTransport`, `TokenProvider`, `Logger` — not concretes. Defaults
   (`FetchTransport`, `EnvTokenProvider`, `NoopLogger`) are injectable, so tests
   use fakes and consumers can swap transport/secret sources.
3. **Client-side organization model.** Since PurelyMail has no org concept, we
   model named account **profiles** (each with its own `TokenProvider`), tagged
   by `org`, with a `PurelymailWorkspace` that runs operations across a selection
   and aggregates results (partial-failure tolerant).
4. **Extensibility escape hatch.** `PurelymailClient.request(spec, …)` lets
   consumers call new/undocumented endpoints via an `OperationSpec` without
   waiting for a wrapper.

## Consequences

- **+** A web app imports `core` and gets typed, validated, framework-free access;
  the CLI is one of potentially several adapters.
- **+** Testable without network or disk (169+ deterministic tests; 100% on
  critical paths).
- **+** Secret sourcing is pluggable (env → keychain → vault) without touching
  core logic.
- **−** Slightly more structure than a single-file CLI; justified by the explicit
  reuse/extensibility requirement (not gold-plating).
- The keychain adapter lives in the CLI as an **optional** native dependency to
  keep `core` dependency-light and portable.

## Alternatives considered

- **Single package, CLI-first, extract later** — rejected: contradicts the
  "reusable pickup" requirement and incurs a later migration.
- **Bundle keychain into core** — rejected: pulls a native dependency into the
  web-reuse surface.
