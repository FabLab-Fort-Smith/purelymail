# Contributing

Thanks for helping improve this (unofficial) PurelyMail toolkit.

## Setup

```bash
corepack enable
pnpm install
pnpm check   # format:check + lint + typecheck + test (coverage) + build
```

Node ≥ 22.12 (24 LTS recommended). The repo is a pnpm workspace: `packages/core` (library) and
`packages/cli` (CLI).

## Live smoke test (manual)

`scripts/e2e-live.sh <verified-domain>` runs a full end-to-end check against the **real**
PurelyMail API — reads plus the user / app-password / password-reset / routing lifecycles —
using throwaway `clitest*` resources it deletes (even on early exit via an EXIT trap). It needs a
live token (read from the configured profile's token env var, or prompted **masked**) and a domain
you have verified. Because it mutates the account it is **not** a CI gate; CI's sanctioned live
check is the read-only, secret-gated `.github/workflows/live-contract.yml` (COMPLIANCE EX-4). Build
the CLI first: `pnpm --filter @fablabfortsmith/purelymail-cli build`.

## Workflow

- Branch from `main`: `type/short-description` (e.g. `feat/routing-import`).
- **Conventional Commits** (`feat`, `fix`, `docs`, `refactor`, `test`, `chore`,
  `build`, `ci`, `perf`, `security`), imperative, ≤72-char subject.
- Commits are signed; author email is the maintainer's GitHub noreply address.
- Open a PR; all CI gates must be green and at least one review is required.
  Security-relevant changes (auth, crypto, deps, CI) get a security-focused review.

## Definition of done

- `pnpm check` passes locally.
- **Coverage:** 100% on critical paths (`packages/core/src/{errors,http,auth}`),
  ≥90% line+branch elsewhere. Add a regression test for every bug fixed first.
- **Docs:** every exported symbol has TSDoc (eslint enforces this).
- Update `CHANGELOG.md` (Unreleased) and, if you touch a trust boundary, the
  threat model.
- Any new SSDLC deviation is annotated in-code and added to `COMPLIANCE.md` with
  an owner and expiry — no silent exceptions.

## Guidelines

- The `core` package stays framework-free and depends only on `zod` + the
  platform `fetch`. Keep IO behind the ports (`HttpTransport`/`TokenProvider`/
  `Logger`).
- Never read secrets from CLI flags; use env/keychain/stdin. Never log the token.
- Treat every PurelyMail response as untrusted — validate it with a schema.

## Verifying against the live API

Live calls require a real token and mutate a real account (a gated action).
Do this manually against a throwaway account; do not add token-bearing steps to
PR CI.
