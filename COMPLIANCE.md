# SSDLC Compliance — status, annotated exceptions & time-boxed exclusions

This repository enforces the master SSDLC ruleset (`~/.claude/CLAUDE.md`) and the
modules imported in [`CLAUDE.md`](./CLAUDE.md). Per the mandate, every place we do
**not** yet fully satisfy a requirement is recorded here with a reason, an owner,
and an **expiry** (time-box) — no permanent, silent exceptions.

- **Owner:** repository maintainer (`134006168+0xb007ab1e@users.noreply.github.com`)
- **Baseline established:** 2026-08-02
- **Review cadence:** re-evaluate every open item at each release and at least
  every 30 days.

## Definition-of-Done status (master §8)

| Requirement                                               | Status     | Notes                                                                       |
| --------------------------------------------------------- | ---------- | --------------------------------------------------------------------------- |
| Language + standard modules, secure-by-default            | ✅ Met     | strict TS/ESM, zod validation, https-only, fail-closed                      |
| Tests: 100% critical / ≥90% line+branch; regression tests | ✅ Met     | enforced per-file in `vitest.config.ts` (279 tests)                         |
| Lint/format/type-check clean                              | ✅ Met     | `pnpm check` green                                                          |
| CI security gates (SAST/SCA/secret/IaC/image)             | ⚠️ Partial | required checks enforced on `main` (EX-1); SCA in release.yml pending (#22) |
| No secrets committed; sensitive data redacted             | ✅ Met     | token via provider only; client redacts; gitleaks config                    |
| Docs updated (TSDoc + generator)                          | ✅ Met     | eslint enforces TSDoc; typedoc configured                                   |
| Reviewed via PR; security-focused review                  | ✅ Met     | required via branch protection (1 approval, dismiss-stale); EX-1            |
| Deps vetted/pinned; SBOM/provenance for releases          | ✅ Met     | pinned + lockfile; release CI does SBOM+provenance+sign (EX-2)              |
| Generated/third-party code verified                       | ✅ Met     | API surface verified against the official OpenAPI spec                      |
| Threat model (new trust boundary)                         | ✅ Met     | `docs/security/threat-model.md`                                             |
| Mutation testing on critical modules                      | ✅ Met     | StrykerJS 85.56% on critical+core (EX-3); client-graph EX-3b                |
| E2E / DAST against deployed env                           | 🚫 N/A     | see NA-1 (library+CLI, no deployed service)                                 |

## Open exceptions (time-boxed)

### EX-1 — Git signing, branch protection & mandatory PR review — mostly ENFORCED

- **Rule:** `workflow-git`, `workflow-cicd` (protected `main`, signed commits,
  ≥1 approving review).
- **Enforced (2026-08-07):** branch protection is now active on `main`:
  - Required **status checks (strict / up-to-date)**: `Build & test (Node 22)`,
    `Build & test (Node 24)`, `Security gates` — the full `pnpm check` gate plus
    SCA/secret-scan block every merge.
  - **Required PR review** — 1 approving review, stale reviews dismissed on new
    commits.
  - **Linear history** required; **force-push and branch deletion disabled**;
    **conversation resolution** required.
  - All CI `uses:` actions **pinned to commit SHAs** (digests) with the tag in a
    trailing comment.
- **Remaining sub-items (pre-`npm publish`):**
  1. **Required signed commits** — not yet toggled (the API sub-endpoint was
     unavailable to the automation token); enable via **Settings → Branches →
     `main` → "Require signed commits"**. GitHub signs squash-merges, so this
     only blocks bypassing direct pushes.
  2. **`enforce_admins` is `false`** — a deliberate deviation so the solo
     maintainer isn't locked out of merging (required review with admin
     enforcement + no second approver = no merges). Turn on once a second
     maintainer or an approving bot exists.
  3. Set the **`NPM_TOKEN`** repository secret (also tracked under EX-2).
- **Exit / expiry:** enable required signed commits and flip `enforce_admins`
  **before the first `npm publish`** (with a second approver in place).

### EX-2 — SBOM, provenance & artifact signing — ✅ IMPLEMENTED (2026-08-02)

- **Rule:** `std-supplychain`, `workflow-cicd`.
- **Status:** release pipeline wired (`.github/workflows/release.yml`, tag
  `v*`): runs the full gate, packs the workspace tarballs, generates a **CycloneDX
  SBOM** (checksum-verified Syft binary — same vendoring pattern as gitleaks),
  attaches **signed build-provenance** (`actions/attest-build-provenance`) and a
  **signed SBOM attestation** (`actions/attest-sbom`), then publishes to npm with
  **provenance** (`pnpm publish --provenance`, `id-token` OIDC;
  `publishConfig.provenance: true`). SBOM + tarballs are uploaded to the GitHub
  release. All actions SHA-pinned.
- **Remaining (verify on first release):** set the `NPM_TOKEN` repository secret;
  cut the first `vX.Y.Z` tag and confirm the SBOM + attestations are produced and
  attached (**before v1.0.0**).

### EX-3 — Mutation testing on critical modules — ✅ DONE (2026-08-02)

- **Rule:** master §4 (mutation testing to validate test quality).
- **Status:** StrykerJS wired (`stryker.config.mjs`, `pnpm test:mutation`,
  `.github/workflows/mutation.yml` — scheduled weekly + on core-touching PRs).
  Current **mutation score 85.56%** (237 killed / 38 survived) across the critical
  paths (`errors.ts`, `http/**`, `auth/**`) and core logic (`retry`, `config`,
  `logging`, `profiles`); `thresholds.break = 80` fails CI below the floor.
- **Follow-up (not blocking):** ratchet `break` toward ≥90 by killing the 38
  surviving mutants (auth 4, http 5, logging 5, config 9, retry 5, profiles 9,
  errors 1) — highest priority on the critical modules.

### EX-3b — Mutation coverage of the client-graph modules

- **Rule:** master §4.
- **Why deferred:** `services/*`, `client.ts`, `schemas.ts`, `workspace.ts` are
  **excluded from the mutate set**. Not a test gap — each has real tests and ~99%
  line coverage — but the Stryker vitest-runner (9.6.1) only collects 44 of the
  279 tests under **Vitest 4.1** (the client-graph test files aren't picked up),
  so their mutants falsely report "no coverage".
- **Compensating control:** these modules keep the ≥90% line/branch coverage gate
  (100% on critical globs) enforced in `vitest.config.ts`; schema validation has
  dedicated `schemas.test.ts` assertions.
- **Exit / expiry:** re-include in `stryker.config.mjs` `mutate` once the
  Stryker↔Vitest-4 runner gap is resolved upstream (or the runner is swapped).
  **Re-evaluate 2026-10-01.**

### EX-4 — Live-API contract/integration test — ✅ SCAFFOLDED (2026-08-02)

- **Rule:** master §4 (contract tests for service boundaries; E2E for journeys).
- **Status:** opt-in, secret-gated live contract test in place:
  `packages/core/test/live/contract.live.test.ts` — **read-only** only
  (`domains.list()`, `account.credit()`; never creates/modifies/deletes), gated
  on `PURELYMAIL_LIVE_TOKEN` and **skips (fails closed)** without it. Excluded
  from the default suite (`vitest.config.ts`); runs via `pnpm test:live`
  (`vitest.live.config.ts`). CI: `.github/workflows/live-contract.yml` —
  **manual dispatch only**, bound to a protected `live-api` environment, secret
  from `secrets.PURELYMAIL_LIVE_TOKEN`. Never on push/PR.
- **Remaining (verify with a real token):** add the `PURELYMAIL_LIVE_TOKEN`
  secret and dispatch once to confirm the live responses match the schemas
  (feeds EX-5). Extend read-only coverage (e.g. `users.list` on a known domain)
  as desired. **Before v1.0.0.**

### EX-5 — Response-envelope & `type` field modeling assumption

- **Rule:** "verify third-party code/contracts" (master §1), `topic-api-consumption`.
- **Why:** the official OpenAPI models success as `{ result: … }` and defines an
  `Error {code,message}` schema, but does not wire the `{ type: "success" | "error" }`
  discriminator PurelyMail returns in practice, and models the password-reset
  `type` as an empty object though the API returns the string `"email"`/`"phone"`.
- **Decision:** the client handles **both** shapes defensively (prefers the
  `type` discriminator, falls back to `result`/`code` presence, fails closed on
  unknown shapes) and models `type` as a string. Documented inline in
  `packages/core/src/schemas.ts` and `client.ts`.
- **Exit / expiry:** confirm against a live response and tighten if needed when
  EX-4 lands.

### EX-6 — Keychain provider not covered by a cross-platform CI matrix

- **Rule:** `topic-testing` (hermetic, platform-representative testing).
- **Why:** `@napi-rs/keyring` is an **optional** native dependency; its real
  backends (Keychain/libsecret/Credential Manager) are OS-specific.
- **Compensating control:** `KeychainTokenProvider` takes an injectable loader
  and is 100% covered with fakes; the missing-module and empty-secret paths are
  tested; it fails closed with a clear message when the native dep is absent.
- **Exit / expiry:** add an OS matrix smoke test (macOS/Linux/Windows) **before
  v1.0.0** if keychain usage is promoted from optional to recommended.

## Accepted residual risks

### RR-1 — Welcome email carries a temporary mailbox password

- **Rule:** `topic-notifications` ("don't put secrets/PII in email/SMS bodies;
  prefer a link to the authenticated app"), master §5.
- **What:** the opt-in `users create --notify` / TUI notify flow emails the new
  mailbox's **temporary password** to the user's recovery address
  (`packages/notify/src/welcome.ts`). PurelyMail exposes no reset-link API, so a
  link-based onboarding isn't available; the password is the deliverable.
- **Compensating controls:** opt-in only (`--notify`); sent to the **recovery**
  address, never the new mailbox; recovery address is **format-validated and
  fails closed** before the credential is built (CLI pre-create check +
  `buildWelcomeEmail` re-validates); outward send is **confirmed** unless
  `--yes` (and `--yes` is **required** in a non-interactive shell); the message
  is **multipart** (styled HTML + plain-text fallback) with **every interpolated
  value HTML-escaped** and the login-URL scheme restricted to `http(s)`, so the
  HTML body carries no injection surface (`escapeHtml` + the scheme guard in
  `buildWelcomeEmail`); the body includes a "change this password as soon as
  possible" instruction; the SMTP transport is TLS and the password is never
  logged. `nodemailer >= 9.0.1` (clears the message-misrouting advisory
  GHSA-mm7p-fcc7-pg87).
- **Exit / expiry:** switch to a one-time reset/login link if PurelyMail adds a
  reset-token API. Re-evaluate at v1.0.0.

## Coverage-exclusion annotations (in-code)

These are the only places test coverage is deliberately excluded, each annotated
inline and justified (defensive, effectively-unreachable branches):

| Location                                                      | Annotation                   | Reason                                                                      |
| ------------------------------------------------------------- | ---------------------------- | --------------------------------------------------------------------------- |
| `packages/core/src/auth/token-provider.ts` (`readProcessEnv`) | `/* v8 ignore next */`       | non-Node host fallback (`process.env` absent) — unreachable under Node      |
| `packages/cli/src/config-file.ts` (`statSync` catch)          | `/* v8 ignore start/stop */` | `statSync` of a file just read by `readFileSync` does not fail in practice  |
| `packages/cli/src/prompt.ts` (`askSecret` echo mute)          | `/* v8 ignore start/stop */` | TTY echo suppression only runs on an interactive terminal (not headless CI) |
| `packages/cli/src/config-store.ts` (`(root)` path fallback)   | `/* v8 ignore next */`       | TOML always parses to a table, so zod issue paths are never empty here      |

## Dependency currency

Dependencies are pinned to exact, latest **compatible** stable versions
(reviewed 2026-08-02). One deliberate hold: **TypeScript is pinned to 6.0.3, not
7.0.x** — the current `typescript-eslint@8.65` (supports TS `<6.1.0`) and
`typedoc@0.28` (supports TS `≤6.0.x`) do not yet support the TypeScript 7 native
compiler, so adopting it would break the mandated lint + docs gates. Re-evaluate
when the toolchain adds TS 7 support. Node floor is **22.12** (required by
`pnpm@11.18` and `commander@15`).

## Not applicable

### NA-1 — DAST / E2E against a deployed ephemeral environment

This project ships a **library and a CLI**, not a deployed network service, so
there is no running endpoint to dynamically scan. The equivalent assurance is
provided by unit/negative/abuse tests, schema validation of the untrusted
upstream, and (per EX-4) an opt-in live-API contract test. Re-evaluate if a
hosted service is ever added on top of the core.
