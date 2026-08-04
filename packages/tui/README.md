# @fablabfortsmith/purelymail-tui

> **Unofficial.** Not affiliated with or endorsed by PurelyMail.

A terminal UI (TUI) for managing PurelyMail across many accounts/organizations,
built on [`@fablabfortsmith/purelymail-core`](../core). It's a third adapter over
the same core library that powers the [CLI](../cli) — no new API surface, the
same trust boundary (token via a provider, redaction), and it reuses
`PurelymailWorkspace` for cross-account aggregation.

## Status

**Multi-org dashboard with interactive management.** A tabbed, aggregated view
across every configured account — **domains** (with per-record MX/SPF/DKIM/DMARC
status), **users**, **routing** rules, and **credit** — each row tagged with its
source profile/org, and per-account failures surfaced inline (one bad account
never blanks the view). Reuses `PurelymailWorkspace` for the aggregation.

On the **users** and **routing** tabs you can select a row (↑/↓) and manage it,
acting on that row's own account: create (`n`), edit users (`e`), delete
(`d`, confirmed). Creating on a multi-account setup first prompts for the target
account. Mutations go through the same `core` services as the CLI; secrets
(passwords) are entered masked.

## Run

```bash
pnpm --filter @fablabfortsmith/purelymail-tui build
purelymail-tui            # or: node packages/tui/dist/bin.js
```

Profiles and tokens come from the same configuration the CLI uses (a profile's
token is sourced from its env var or the OS keychain — never stored in config).

## Keys

| Key            | Action                                        |
| -------------- | --------------------------------------------- |
| `tab` / `→`    | next view (domains/users/routing/credit)      |
| `←`            | previous view                                 |
| `↑` / `↓`      | select a row (users/routing)                  |
| `n`            | new user (users) / new routing rule (routing) |
| `e`            | edit selected user                            |
| `d`            | delete selected user / routing rule (confirm) |
| `r`            | refresh the current view                      |
| `q` / `Ctrl-C` | quit                                          |

Inside a form: `enter` advances, `y`/`n` answers flags, `esc` cancels.
