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

| Requirement                                               | Status        | Notes                                                    |
| --------------------------------------------------------- | ------------- | -------------------------------------------------------- |
| Language + standard modules, secure-by-default            | ✅ Met        | strict TS/ESM, zod validation, https-only, fail-closed   |
| Tests: 100% critical / ≥90% line+branch; regression tests | ✅ Met        | enforced per-file in `vitest.config.ts` (170 tests)      |
| Lint/format/type-check clean                              | ✅ Met        | `pnpm check` green                                       |
| CI security gates (SAST/SCA/secret/IaC/image)             | ⚠️ Partial    | see EX-1 (repo not yet hosted); config committed         |
| No secrets committed; sensitive data redacted             | ✅ Met        | token via provider only; client redacts; gitleaks config |
| Docs updated (TSDoc + generator)                          | ✅ Met        | eslint enforces TSDoc; typedoc configured                |
| Reviewed via PR; security-focused review                  | ⚠️ Deferred   | see EX-1                                                 |
| Deps vetted/pinned; SBOM/provenance for releases          | ⚠️ Partial    | pinned + lockfile; SBOM/provenance in release CI (EX-2)  |
| Generated/third-party code verified                       | ✅ Met        | API surface verified against the official OpenAPI spec   |
| Threat model (new trust boundary)                         | ✅ Met        | `docs/security/threat-model.md`                          |
| Mutation testing on critical modules                      | ⏳ Time-boxed | see EX-3                                                 |
| E2E / DAST against deployed env                           | 🚫 N/A        | see NA-1 (library+CLI, no deployed service)              |

## Open exceptions (time-boxed)

### EX-1 — Git signing, branch protection & mandatory PR review

- **Rule:** `workflow-git`, `workflow-cicd` (protected `main`, signed commits,
  ≥1 approving review).
- **Why deferred:** the project is a local greenfield with no hosting remote yet.
  No commits have been made (commit/push are gated actions awaiting the human).
- **Compensating control:** all gate checks (`pnpm check`) pass locally; the CI
  workflow (`.github/workflows/ci.yml`) is committed and will enforce gates on
  the first push; commit identity is preconfigured to the mandated noreply email.
- **Exit / expiry:** enable branch protection + required signed commits + review
  **at repository creation on GitHub, and before the first `npm publish`.**

### EX-2 — SBOM, provenance & artifact signing

- **Rule:** `std-supplychain`, `workflow-cicd`.
- **Why partial:** dependencies are pinned with a committed `pnpm-lock.yaml`;
  npm provenance is enabled (`publishConfig.provenance: true`). A CycloneDX SBOM
  and signed provenance are produced by the **release** workflow, not on every
  local build.
- **Exit / expiry:** verify SBOM + provenance attestation are attached to the
  first tagged release (**before v1.0.0**).

### EX-3 — Mutation testing on critical modules

- **Rule:** master §4 (mutation testing to validate test quality).
- **Why deferred:** initial delivery prioritized correctness + 100% critical-path
  coverage. Mutation testing (e.g. StrykerJS) is not yet wired.
- **Compensating control:** critical paths (auth/token, transport, error mapping)
  are at 100% line+branch, plus abuse-path and negative tests.
- **Exit / expiry:** add StrykerJS on `packages/core/src/{client,errors,http,auth}`
  **by 2026-09-01.**

### EX-4 — Live-API contract/integration test

- **Rule:** master §4 (contract tests for service boundaries; E2E for journeys).
- **Why deferred:** exercising the real PurelyMail API requires a live token (a
  restricted secret) and mutates a real account — a gated, credential-bearing
  action unsuitable for default CI.
- **Compensating control:** the client is validated against the **official
  OpenAPI spec** (see `docs/reference/purelymail-api.md`); every request/response
  is schema-checked; a fake transport drives 170 deterministic tests.
- **Exit / expiry:** add an opt-in, secret-gated integration job (manual dispatch)
  **before v1.0.0**; keep it out of PR CI.

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

## Coverage-exclusion annotations (in-code)

These are the only places test coverage is deliberately excluded, each annotated
inline and justified (defensive, effectively-unreachable branches):

| Location                                                      | Annotation                   | Reason                                                                     |
| ------------------------------------------------------------- | ---------------------------- | -------------------------------------------------------------------------- |
| `packages/core/src/auth/token-provider.ts` (`readProcessEnv`) | `/* v8 ignore next */`       | non-Node host fallback (`process.env` absent) — unreachable under Node     |
| `packages/cli/src/config-file.ts` (`statSync` catch)          | `/* v8 ignore start/stop */` | `statSync` of a file just read by `readFileSync` does not fail in practice |

## Not applicable

### NA-1 — DAST / E2E against a deployed ephemeral environment

This project ships a **library and a CLI**, not a deployed network service, so
there is no running endpoint to dynamically scan. The equivalent assurance is
provided by unit/negative/abuse tests, schema validation of the untrusted
upstream, and (per EX-4) an opt-in live-API contract test. Re-evaluate if a
hosted service is ever added on top of the core.
