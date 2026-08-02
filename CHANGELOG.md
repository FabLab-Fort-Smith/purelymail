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

[Unreleased]: https://github.com/FabLab-Fort-Smith/purelymail/commits/main
