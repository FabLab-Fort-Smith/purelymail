# purelymail (monorepo) — project rules

> Inherits the master SSDLC ruleset (`~/.claude/CLAUDE.md`) automatically.
> **All master mandates are in force for this repository.** Any deviation is
> documented, annotated, and time-boxed in [`COMPLIANCE.md`](./COMPLIANCE.md) —
> nothing is silently relaxed.

An **unofficial** TypeScript library + CLI for the PurelyMail API. Two published
packages in a pnpm workspace:

- `packages/core` — `@fablabfortsmith/purelymail-core`: framework-free client,
  ports (transport/token/logger), services, multi-account/organization
  aggregation. The reusable pickup for other projects (web backends, bots).
- `packages/cli` — `@fablabfortsmith/purelymail-cli`: thin `commander` adapter.

Not affiliated with or endorsed by PurelyMail.

## Applied rule modules

@~~/.claude/rules/lang-typescript.md
@~~/.claude/rules/lang-shell.md
@~~/.claude/rules/std-owasp-proactive.md
@~~/.claude/rules/std-cwe.md
@~~/.claude/rules/std-supplychain.md
@~~/.claude/rules/std-privacy.md
@~~/.claude/rules/topic-api-consumption.md
@~~/.claude/rules/topic-error-handling.md
@~~/.claude/rules/topic-defensive-programming.md
@~~/.claude/rules/topic-resource-management.md
@~~/.claude/rules/topic-config-environments.md
@~~/.claude/rules/topic-testing.md
@~~/.claude/rules/topic-documentation.md
@~~/.claude/rules/topic-license-compliance.md
@~~/.claude/rules/workflow-code-review.md
@~~/.claude/rules/workflow-cicd.md
@~~/.claude/rules/workflow-release.md
@~~/.claude/rules/workflow-vuln-mgmt.md
@~~/.claude/rules/workflow-cve-management.md
@~~/.claude/rules/workflow-threat-model.md

## Stack

- Runtime: Node ≥ 22.12 (24 LTS recommended), ESM, TypeScript strict.
- Packages: pnpm workspace; build via tsup; test via vitest; lint via
  typescript-eslint + eslint-plugin-jsdoc; docs via typedoc.
- Runtime deps: `zod` (core); `commander` + `smol-toml` (CLI);
  `@napi-rs/keyring` is an **optional** native dep (keychain only).

## Project-specific rules

- **Data classification:** email addresses, usernames, and recovery
  email/phone are **personal data (confidential)** — never log them at info+,
  redact in errors (`std-privacy`, master §5). The API token is **restricted**.
- **Secrets:** the PurelyMail API token is sourced only via a `TokenProvider`
  (env var by default, OS keychain optional). Never a CLI flag, never written to
  the config file, never logged (the client redacts it from all output).
- **Trust boundary:** the PurelyMail API is an untrusted upstream — every
  response is schema-validated (`topic-api-consumption`); the base URL is a
  fixed https constant (no SSRF surface).
- **Gated actions:** publishing to npm, tagging, pushing, and any deploy are
  human-gated (`workflow-gated-actions`); they are prepared but never performed
  autonomously. Destructive CLI commands confirm unless `--yes`.
- **Testing:** 100% coverage on critical paths (auth/token, HTTP transport,
  error mapping) enforced per-file in `vitest.config.ts`; ≥90% line+branch
  elsewhere. Deviations are annotated with `/* v8 ignore … -- reason */` and
  listed in `COMPLIANCE.md`.
- **Docs:** every exported symbol carries TSDoc (enforced by eslint); typedoc
  builds `docs/api` in CI.
