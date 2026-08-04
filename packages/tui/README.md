# @fablabfortsmith/purelymail-tui

> **Unofficial.** Not affiliated with or endorsed by PurelyMail.

A terminal UI (TUI) for managing PurelyMail across many accounts/organizations,
built on [`@fablabfortsmith/purelymail-core`](../core). It's a third adapter over
the same core library that powers the [CLI](../cli) — no new API surface, the
same trust boundary (token via a provider, redaction), and it reuses
`PurelymailWorkspace` for cross-account aggregation.

## Status

**Read-first multi-org dashboard.** A tabbed, aggregated view across every
configured account — **domains** (with per-record MX/SPF/DKIM/DMARC status),
**users**, **routing** rules, and **credit** — each row tagged with its source
profile/org, and per-account failures surfaced inline (one bad account never
blanks the view). Reuses `PurelymailWorkspace` for the aggregation. Interactive
create/modify/delete flows are a later pass.

## Run

```bash
pnpm --filter @fablabfortsmith/purelymail-tui build
purelymail-tui            # or: node packages/tui/dist/bin.js
```

Profiles and tokens come from the same configuration the CLI uses (a profile's
token is sourced from its env var or the OS keychain — never stored in config).

## Keys

| Key            | Action                                   |
| -------------- | ---------------------------------------- |
| `tab` / `→`    | next view (domains/users/routing/credit) |
| `←`            | previous view                            |
| `r`            | refresh the current view                 |
| `q` / `Ctrl-C` | quit                                     |
