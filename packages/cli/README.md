# @fablabfortsmith/purelymail-cli

Unofficial command-line interface to manage [PurelyMail](https://purelymail.com):
domains, users/mailboxes, routing, password resets, app passwords, and account
credit — across one or many accounts and organizations. Built on
[`@fablabfortsmith/purelymail-core`](https://www.npmjs.com/package/@fablabfortsmith/purelymail-core).

> Not affiliated with or endorsed by PurelyMail.

```bash
npm i -g @fablabfortsmith/purelymail-cli
export PURELYMAIL_API_TOKEN="…"   # PurelyMail → account → Refresh API Key
purelymail --help
```

## Commands

```
purelymail init                       # interactive first-time setup
purelymail profiles list|orgs|add|edit|remove|set-default
purelymail domains list|add|ownership|update|delete
purelymail users list|get|create|modify|delete
purelymail routing list|create|delete
purelymail password-reset list|upsert|delete
purelymail app-password create|delete
purelymail account credit
```

Global options: `--profile <name>`, `--org <name>`, `--all`, `--json`, `--yes`,
`--config <path>`, `--timeout <ms>`, `--base-url <url>`.

## Examples

```bash
purelymail domains list --all --json
purelymail users create admin example.com --password-stdin <<<'…'
purelymail users create admin example.com --generate-password             # prints a strong password once
purelymail users create admin example.com --generate-password \
  --notify --recovery-email me@backup.com                                 # emails the details to the recovery address
purelymail users modify admin@example.com --require-2fa --disable-search-indexing
purelymail routing create --domain example.com --match-user '' --catchall --target admin@example.com
purelymail password-reset upsert admin@example.com --type email --target me@backup.com
purelymail app-password create admin@example.com --name laptop     # prints the password once
purelymail domains delete old.example.com --yes
```

## Profiles & organizations

See the [repository README](https://github.com/FabLab-Fort-Smith/purelymail#multiple-accounts--organizations)
and [`examples/purelymail.config.toml`](https://github.com/FabLab-Fort-Smith/purelymail/blob/main/examples/purelymail.config.toml).
Config holds non-secret metadata only; tokens come from env vars or the OS
keychain (optional `@napi-rs/keyring`).

## Welcome emails (`--notify`)

`users create --generate-password --notify --recovery-email <addr>` emails the
new mailbox's details (address, password, IMAP/SMTP/login settings) to the
**recovery** address. It needs a `[notify]` SMTP section in the config:

```toml
[notify]
host = "smtp.purelymail.com"
port = 465
user = "postmaster@example.com"
# from = "postmaster@example.com"   # optional; defaults to user
# passwordEnv = "PURELYMAIL_SMTP_PASSWORD"   # default; or keychain = true
```

The SMTP password is a **secret** — sourced from `PURELYMAIL_SMTP_PASSWORD` (or
`passwordEnv`), or the OS keychain (`keychain = true`); never stored in the
config. The outward send is confirmed unless `--yes`; a send failure warns but
does not fail the create (the user already exists).

## Safety

- Secrets are read from **stdin** (`--password-stdin`, `--app-password-stdin`) or
  a **named env var** (`--password-env`, `--app-password-env`) — never a plain
  flag. The token is never logged.
- Destructive commands confirm interactively (or require `--yes`); they refuse to
  run unconfirmed in a non-interactive shell.

## Exit codes

`0` success · `1` generic · `2` usage/validation · `3` auth · `4` API error ·
`5` config · `6` transport/timeout · `7` confirmation required/declined.

## Embedding

The CLI is also importable to extend or reuse its command tree:

```ts
import { run, buildProgram } from '@fablabfortsmith/purelymail-cli';
await run(process.argv.slice(2));
```

MIT licensed.
