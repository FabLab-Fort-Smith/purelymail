# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Added
- **`@fablabfortsmith/purelymail-core`** — framework-free PurelyMail API client:
  - Namespaced services: `domains`, `users`, `routing`, `passwordResets`,
    `appPasswords`, `account` (full v0 surface: 19 operations).
  - Injectable ports: `HttpTransport` (default `FetchTransport`), `TokenProvider`
    (`EnvTokenProvider`, `StaticTokenProvider`), `Logger` (redacting).
  - Typed error hierarchy, request/response zod validation, bounded retry with
    backoff + jitter and `Retry-After`, per-request timeout, token redaction.
  - Multi-account/organization support: `Profile`, `ProfileRegistry`,
    `PurelymailWorkspace` (partial-failure-tolerant cross-account aggregation).
  - Low-level `request(spec)` escape hatch for new endpoints.
- **`@fablabfortsmith/purelymail-cli`** — thin `commander` CLI:
  - Commands for every operation plus `profiles list|orgs`.
  - `--profile` / `--org` / `--all` account selection with aggregated output.
  - TOML profile config (`config.toml`, non-secret metadata only); tokens from
    env var or OS keychain (optional `@napi-rs/keyring`).
  - `--json` output, destructive-action confirmation (`--yes`), secrets via
    stdin/env (never flags), stable exit codes.
  - Interactive configuration wizard: `init` and
    `profiles add|edit|remove|set-default` — writes the TOML config (`chmod 600`,
    tightened on overwrite), stores keychain tokens via a muted prompt, and for
    the env-var source prints the `export` line without writing the secret.
    Refuses to run in a non-interactive shell (fails closed).

### Testing
- **Mutation testing (StrykerJS)** wired via `stryker.config.mjs` +
  `pnpm test:mutation` (EX-3). Scoped to the critical paths (`errors`, `http`,
  `auth`) and core logic (`retry`, `config`, `logging`, `profiles`); current
  score **85.56%**, CI `break` gate at 80. Runs weekly and on core-touching PRs
  (`.github/workflows/mutation.yml`). Client-graph modules deferred pending a
  Stryker↔Vitest-4 runner fix (EX-3b).
- **Live-API contract test (opt-in, secret-gated)** — `pnpm test:live` +
  `vitest.live.config.ts` + `packages/core/test/live/contract.live.test.ts`
  (EX-4). Read-only (`domains.list`, `account.credit`), gated on
  `PURELYMAIL_LIVE_TOKEN`, skips (fails closed) without it, excluded from the
  default suite. CI: `.github/workflows/live-contract.yml` (manual dispatch only,
  protected `live-api` environment).

### Security / CI
- All CI `uses:` actions **pinned to commit SHAs** (digests) with the version in
  a trailing comment (std-supplychain; EX-1 SHA-pin sub-item).
- **Release pipeline** (`.github/workflows/release.yml`, tag `v*`) producing a
  **CycloneDX SBOM** (checksum-verified Syft), **signed build-provenance + SBOM
  attestations**, and npm publish **with provenance** (EX-2). SHA-pinned.

[Unreleased]: https://github.com/FabLab-Fort-Smith/purelymail/commits/main
