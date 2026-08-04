# @fablabfortsmith/purelymail-tui

> **Unofficial.** Not affiliated with or endorsed by PurelyMail.

A terminal UI (TUI) for managing PurelyMail across many accounts/organizations,
built on [`@fablabfortsmith/purelymail-core`](../core). It's a third adapter over
the same core library that powers the [CLI](../cli) — no new API surface, the
same trust boundary (token via a provider, redaction), and it reuses
`PurelymailWorkspace` for cross-account aggregation.

## Status

**Phase 1 scaffold.** Renders a title bar and quits on `q` / `Ctrl-C`. The
read-first **multi-org dashboard** — browse profiles/orgs → domains, users,
routing, and credit across accounts, drill in, refresh — is landing next.

## Run

```bash
pnpm --filter @fablabfortsmith/purelymail-tui build
purelymail-tui            # or: node packages/tui/dist/bin.js
```

Profiles and tokens come from the same configuration the CLI uses (a profile's
token is sourced from its env var or the OS keychain — never stored in config).

## Keys

| Key      | Action |
| -------- | ------ |
| `q`      | quit   |
| `Ctrl-C` | quit   |

More keys arrive with the dashboard.
