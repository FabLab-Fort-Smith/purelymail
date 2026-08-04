# @fablabfortsmith/purelymail-config

> **Unofficial.** Not affiliated with or endorsed by PurelyMail.

Shared profile/configuration loading for the PurelyMail toolkit. Reads the
non-secret TOML config file into a core
[`ProfileRegistry`](../core), wiring each profile to its token source — an
environment variable, or the OS keychain (via the optional `@napi-rs/keyring`).
Tokens are **never** stored in the config; only which env var / keychain entry
to read.

Both the [CLI](../cli) and the [TUI](../tui) depend on this package so they load
accounts the same way.

```ts
import { loadProfiles } from '@fablabfortsmith/purelymail-config';

const { registry, defaultProfile } = loadProfiles();
```

`loadProfiles()` falls back to a single implicit `default` profile backed by
`PURELYMAIL_API_TOKEN` when no config file is present.
