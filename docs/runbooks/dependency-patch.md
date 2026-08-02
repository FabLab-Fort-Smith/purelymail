# Runbook: Patch a vulnerable dependency

## When to use

- SCA (`pnpm audit`) or an advisory (OSV/GHSA/NVD, or a new CISA KEV entry) flags
  a vulnerable dependency in `core` or `cli`.

## Severity / impact

- Score with CVSS + EPSS + KEV and assess reachability (is the vulnerable code
  path actually used?). Set the SLA per `SECURITY.md` (Critical/KEV: 24–72h).

## Prerequisites & access

- Repo write access; the committed `pnpm-lock.yaml` to locate the affected
  version across the workspace.

## Steps

1. Confirm exposure: `pnpm audit --audit-level=low` and locate the dependent:
   `pnpm why <package>`. Record a VEX status (affected / not affected + why).
2. Determine the fixed version from the advisory.
3. **Upgrade** (preferred): `pnpm up <package>@<fixed>` (or update the direct dep
   and refresh the lockfile). For a transitive dep, add a `pnpm.overrides` entry.
4. Run the full gate: `pnpm check`. Watch for breaking changes.
5. Re-audit: `pnpm audit --audit-level=high` → finding gone.
6. Add a regression/behavioural test if the vuln was reachable through our code.

## Verification

- `pnpm audit` clean at the required level; `pnpm check` green; CHANGELOG updated.

## Escalation

- Actively-exploited (KEV) or evidence of compromise → escalate to incident
  response and rotate any potentially exposed secrets
  (`docs/runbooks/secret-rotation.md`).

## Related

- `COMPLIANCE.md`, `SECURITY.md`.
