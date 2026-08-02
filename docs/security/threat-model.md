# Threat Model — PurelyMail core + CLI

STRIDE over the data-flow of the library and CLI. Reviewed 2026-08-02; revisit on
changes to auth, transport, config parsing, or the trust boundary to PurelyMail.

## System & trust boundaries

```
[operator] --args/env/config--> [CLI adapter] --calls--> [core client]
                                     |                        |
                                 profile store            HTTPS + token
                                 (TOML, env, keychain)         |
                                                               v
                                                     [PurelyMail API]  (untrusted upstream)
```

Trust boundaries:

1. **Operator input → CLI** (args, stdin, env, config file).
2. **CLI/core → secret stores** (env var, OS keychain).
3. **Core → PurelyMail API** (network; the API and its responses are untrusted).

Data classes: **API token = restricted**; **email addresses / usernames /
recovery contacts = confidential personal data**.

## STRIDE

### Spoofing

- **API auth:** every request carries `Purelymail-Api-Token` over TLS 1.2+.
  Base URL is a fixed `https://` constant; non-https is rejected at config time.
- **Profile identity:** tokens are bound to named profiles; the org grouping is
  local metadata only and grants no authority.
- _Mitigations:_ HTTPS enforced (`config.ts`), token from a `TokenProvider` only.

### Tampering

- **Responses:** the upstream is untrusted — every response `result` is
  zod-validated; unknown/error envelopes fail closed.
- **Config file:** parsed with a strict schema; unknown keys rejected; no code
  execution paths (TOML data only).
- _Mitigations:_ schema validation on all boundaries (`schemas.ts`,
  `config-file.ts`); no `eval`/deserialization of untrusted data.

### Repudiation

- Optional structured `Logger` records operations (redacted). The CLI surfaces
  per-account failures rather than hiding them.
- _Residual:_ no tamper-evident audit log (out of scope for a client tool).

### Information disclosure

- **Token:** never logged, never a CLI flag, never written to the config file;
  the client redacts it from every error/log via `createRedactor`.
- **App passwords:** shown once on stdout with a stderr warning; not logged.
- **Personal data:** not logged at info+; kept out of error messages.
- _Mitigations:_ redaction at the logging boundary; secrets read from
  env/keychain/stdin; `.gitignore` excludes `.env`, `*.token`, config files.

### Denial of service

- **Client-side bounds:** per-request timeout (AbortController), bounded retries
  with backoff + jitter, `Retry-After` respected; only safe/idempotent ops retry
  by default.
- _Residual:_ the operator can trigger many aggregated calls (`--all`); bounded
  by the number of configured accounts.

### Elevation of privilege

- **Least privilege:** the token grants exactly the PurelyMail account's rights;
  no local privilege use. Keychain access is per-service/account.
- **Destructive actions** require confirmation (`--yes` or interactive) and, in a
  non-interactive shell, fail closed.
- **Gated actions** (publish/tag/push/deploy) are human-approved, never
  autonomous.

## Abuse cases → tests

- Malformed/injection input at CLI/config boundaries → schema rejection (tested).
- Upstream returns wrong shape / error envelope / non-JSON → typed errors, fail
  closed (tested in `client.test.ts`).
- Token leakage in error text → redaction asserted (tested).
- Cross-account isolation: aggregation tags each result by profile; one bad
  account cannot corrupt another's view (tested in `workspace.test.ts`).
