# Security Policy

> Unofficial project. Not affiliated with PurelyMail. For vulnerabilities in the
> PurelyMail **service**, contact PurelyMail directly.

## Reporting a vulnerability

Please report security issues in **this software** privately:

- Open a [GitHub Security Advisory](https://github.com/FabLab-Fort-Smith/purelymail/security/advisories/new)
  (preferred), or
- email the maintainer listed in the repository metadata.

Do **not** open a public issue for undisclosed vulnerabilities.

Include: affected version/commit, a description, reproduction steps, and impact.
We aim to acknowledge within **72 hours** and to ship a fix or mitigation on the
severity SLA below.

## Remediation SLAs

| Severity                                   | Target       |
| ------------------------------------------ | ------------ |
| Critical (CVSS ≥ 9.0 / actively exploited) | 24–72h       |
| High (7.0–8.9)                             | 7 days       |
| Medium (4.0–6.9)                           | 30 days      |
| Low (< 4.0)                                | next release |

## Handling secrets

- The PurelyMail API **token is a password.** This tool reads it only from an
  environment variable or the OS keychain — never from a command-line flag, and
  never from the profile config file. It is redacted from all logs and errors.
- If you believe a token was exposed, **rotate it immediately** in the PurelyMail
  account settings ("Refresh API Key") and update your env/keychain. See
  `docs/runbooks/secret-rotation.md`.

## Supported versions

Pre-1.0: only the latest published minor receives fixes.

## Disclosure

We practice coordinated disclosure: fix under embargo, then publish a patched
release and advisory with a CVE where warranted.
