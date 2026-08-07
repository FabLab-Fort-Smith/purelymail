# Changelog

All notable changes to this project are documented here. The format follows
[Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and the project uses
[Semantic Versioning](https://semver.org/).

## [Unreleased]

### Changed

- **`@fablabfortsmith/purelymail-tui`** — the create-user form now presents a
  **checkbox options panel** (↑/↓ move, Space toggles, Enter confirms) instead of
  sequential y/n prompts: **auto-generate a strong password** (on by default) and
  **email account details**. Enabling emailing reveals a **required, validated
  recovery address** — the panel refuses to proceed without a valid one (fail
  closed), and that address is **stored on the new account** as its recovery
  address (passed to `createUser`).

### Fixed

- **`@fablabfortsmith/purelymail-tui`** — the create-user options panel no longer
  stores a recovery address that was typed and then disabled: toggling "email
  account details" off clears the recovery field, and only a valid address is
  carried when emailing is on. `buildCreateUser` now validates the recovery
  address (gate-covered) and rejects a malformed one — fail closed for the value
  that governs account password reset.
- **`@fablabfortsmith/purelymail-tui`** — reject an empty password client-side on
  user create (clear "password is required" message) instead of surfacing the
  upstream `password: Too small` API error; `buildCreateUser` also throws on an
  empty password (closes the generate-without-resolve footgun).

## [0.3.0] - 2026-08-06

Adds secure password generation and new-account welcome emails. New fifth
package `notify` (SMTP mailer + welcome template). All published packages bumped
to 0.3.0 in lockstep.

### Added
- **`@fablabfortsmith/purelymail-notify`** (new) — email notifications:
  - `Mailer` port + `SmtpMailer` (nodemailer) with an injectable transport;
    `from` defaults to the auth user; implicit TLS defaults on port 465.
  - `buildWelcomeEmail()` — plain-text (no HTML-injection surface) new-account
    message addressed to the user's **recovery** address, carrying the mailbox
    address, temporary password, IMAP/SMTP/login settings, and a
    change-password nudge.
- **`@fablabfortsmith/purelymail-core`** — `generatePassword()`: CSPRNG
  (`node:crypto`) password generator, class-guaranteed (lower/upper/digit/
  symbol), ambiguous characters excluded, min length 12 (default 20).
- **`@fablabfortsmith/purelymail-config`** — `[notify]` config section
  (host/port/secure/user/from). The SMTP **password is never stored in the
  file**: it resolves from an env var (`passwordEnv`, default
  `PURELYMAIL_SMTP_PASSWORD`) or the OS keychain (`keychain = true`).
  `loadProfiles()` returns a resolved `notify` with a `passwordProvider`.
- **`@fablabfortsmith/purelymail-cli`** — `users create`:
  - `--generate-password` (+ `--password-length`) prints a strong password once.
  - `--notify --recovery-email <addr>` emails the account details to the
    recovery address over the `[notify]` SMTP config. Prerequisites are
    validated before the user is created; the outward send is confirmed unless
    `--yes`; a send failure warns but does not fail the create.
- **`@fablabfortsmith/purelymail-tui`** — the create-user form gains
  "generate a strong password?" and (when `[notify]` is configured) "email
  account details to a recovery address?" steps.

## [0.2.0] - 2026-08-04

Initial published release. (0.1.0 was pre-release and never tagged; the version
was bumped to 0.2.0 once the TUI's interactive CRUD landed before first publish.)
Ships four packages: `core` (API client + multi-account aggregation), `config`
(shared profile/token loader), `cli` (`purelymail`), and `tui` (`purelymail-tui`,
read-first dashboard + interactive users/routing CRUD).

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
  - Typed cross-account aggregators on `PurelymailWorkspace`:
    `listUsers()`, `listRoutingRules()`, `checkCredit()` — each returns items
    annotated with source `profile`/`org` plus per-account failures (parity with
    `listDomains()`, so a library consumer gets org-level views without hand-
    rolling `run()`). The CLI already aggregated these via `--all`/`--org`.
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
- **`@fablabfortsmith/purelymail-tui`** — new terminal-UI package (Ink), a third
  adapter over `core`. Read-first **multi-org dashboard**: a tabbed, aggregated
  view of domains (with MX/SPF/DKIM/DMARC status), users, routing, and credit
  across every configured account (reusing `PurelymailWorkspace`), each row
  tagged with its profile/org and per-account failures surfaced inline. Keys:
  `tab`/`←→` switch view, `r` refresh, `q` quit. Pure data layer (`data.ts`) is
  unit-tested; components have an ink-testing-library render smoke. Profiles/
  tokens load via the shared config package (token stays in env/keychain).
  - **Interactive management** on the users/routing tabs: select a row (↑/↓),
    then create (`n`), edit users (`e`), or delete (`d`, confirmed) — acting on
    that row's own account; multi-account creates prompt for the target account.
    Passwords entered masked; mutations go through the same `core` services as
    the CLI. Keystroke-driven forms (self-contained `useInput` fields), fully
    interaction-tested.
- **`@fablabfortsmith/purelymail-config`** — new shared package holding the
  profile/config loader (`loadProfiles`, `resolveConfigPath`) and token
  resolvers (`KeychainTokenProvider`, env/keychain), extracted from the CLI so
  the CLI **and** TUI load accounts the same way. The CLI re-exports these for a
  stable public API; the TUI now depends on `-config` instead of `-cli`. The
  optional `@napi-rs/keyring` dependency moved with it.

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

[Unreleased]: https://github.com/FabLab-Fort-Smith/purelymail/compare/v0.3.0...HEAD
[0.3.0]: https://github.com/FabLab-Fort-Smith/purelymail/compare/v0.2.0...v0.3.0
[0.2.0]: https://github.com/FabLab-Fort-Smith/purelymail/releases/tag/v0.2.0
