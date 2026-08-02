# purelymail toolkit

Unofficial TypeScript **library + CLI** to manage [PurelyMail](https://purelymail.com)
— domains, users/mailboxes, routing rules, password-reset (recovery) methods, app
passwords, and account credit — across one or many accounts and organizations.

> **Unofficial.** Not affiliated with or endorsed by PurelyMail. Use of the
> PurelyMail API is subject to PurelyMail's terms.

Two packages (pnpm workspace):

| Package                                               | What                                                                                                                                | Install                                    |
| ----------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------ |
| [`@fablabfortsmith/purelymail-core`](./packages/core) | Framework-free API client + multi-account aggregation. The reuse pickup for other apps (web backends, bots). Depends only on `zod`. | `npm i @fablabfortsmith/purelymail-core`   |
| [`@fablabfortsmith/purelymail-cli`](./packages/cli)   | Thin `commander` CLI (`purelymail`).                                                                                                | `npm i -g @fablabfortsmith/purelymail-cli` |

## Quick start (CLI)

```bash
export PURELYMAIL_API_TOKEN="…"        # from PurelyMail → account → Refresh API Key
purelymail account credit              # uses the default single account
purelymail domains list
purelymail users create admin example.com --password-stdin <<<'…'
purelymail routing create --domain example.com --match-user sales --target admin@example.com
```

- Output is a table by default; add `--json` for machine-readable output.
- Destructive commands (`delete`, revoke) prompt for confirmation; pass `--yes`
  to skip (required in non-interactive shells).
- Secrets are read from **stdin or an env var**, never a flag.

## Multiple accounts & organizations

PurelyMail is one token per account, so organizations are a **client-side**
concept here: define named **profiles** in a config file (non-secret metadata),
each pointing at a token in an env var or the OS keychain.

The fastest way to set this up is the interactive wizard (it writes the config
for you, `chmod 600`; for the keychain source it stores the token, for the
env-var source it prints the `export` line and never writes the secret):

```bash
purelymail init                       # guided first profile
purelymail profiles add               # add another account
purelymail profiles edit acme         # change one
purelymail profiles set-default acme  # pick the default
purelymail profiles remove old        # drop one
```

Or hand-author the file directly:

`~/.config/purelymail/config.toml` (see [`examples/`](./examples/purelymail.config.toml)):

```toml
defaultProfile = "acme"

[[profile]]
name = "acme"
org = "Acme Inc"
tokenEnv = "PURELYMAIL_TOKEN_ACME"

[[profile]]
name = "clientb"
org = "Client B LLC"
keychain = true          # needs the optional @napi-rs/keyring
```

Then target accounts by profile, organization, or all at once — results are
aggregated and tagged with their source:

```bash
purelymail domains list --org "Acme Inc"      # every Acme account
purelymail domains list --all                 # every configured account
purelymail account credit --all --json
purelymail users list --profile clientb
purelymail profiles list                      # show configured profiles + token source
```

One failing account never breaks the whole view — its error is reported
alongside the successful accounts' results.

## Library usage

```ts
import { PurelymailClient } from '@fablabfortsmith/purelymail-core';

const client = new PurelymailClient(); // token from PURELYMAIL_API_TOKEN
const { domains } = await client.domains.list({ includeShared: false });
await client.users.create({ userName: 'admin', domainName: 'example.com', password });
```

Everything is injectable (transport, token source, logger) for testing and reuse;
see the [core README](./packages/core/README.md) and generated API docs
(`pnpm docs` → `docs/api`).

## Security

- The API token is treated as a password: env/keychain only, never logged (the
  client redacts it), never a CLI flag.
- Every API response is schema-validated (the upstream is untrusted); HTTPS is
  enforced; requests time out and safe reads retry with backoff.
- Report vulnerabilities per [`SECURITY.md`](./SECURITY.md). Threat model:
  [`docs/security/threat-model.md`](./docs/security/threat-model.md).

## Exit codes (CLI)

`0` success · `1` generic · `2` usage/validation · `3` auth · `4` API error ·
`5` config · `6` transport/timeout · `7` confirmation required/declined.

## Development

```bash
corepack enable && pnpm install
pnpm check        # format + lint + typecheck + test (coverage) + build
```

Node ≥ 22.12 (24 LTS recommended). See [`CONTRIBUTING.md`](./CONTRIBUTING.md) and
[`COMPLIANCE.md`](./COMPLIANCE.md) (SSDLC status + annotated, time-boxed
exceptions). Licensed under [MIT](./LICENSE).
