# Runbook: Rotate a PurelyMail API token

## When to use

- Scheduled rotation, suspected/confirmed token exposure (treat any committed or
  logged token as compromised), or when an operator with access leaves.

## Prerequisites & access

- Sign-in access to the affected PurelyMail account.
- Access to wherever the token is stored for this profile: the environment
  variable named by `tokenEnv`, or the OS keychain (`service=purelymail`,
  `account=<keychainAccount|name>`), plus any CI secret store.

## Steps

1. **Generate a new token:** PurelyMail account settings → **Refresh API Key** →
   copy the new key. (PurelyMail issues a single active API key per account, so
   refreshing immediately invalidates the old one — plan for brief overlap.)
2. **Update every consumer** of this profile's token:
   - Env var: update `PURELYMAIL_TOKEN_<PROFILE>` in your shell profile / secret
     manager / CI secret.
   - Keychain: store the new value, e.g. via your OS keychain tool for
     `service=purelymail`, `account=<name>`.
3. **Verify:** run a read-only command with that profile:
   ```bash
   purelymail account credit --profile <name>
   ```
   Expect a credit value (exit 0), not an auth error (exit 3).
4. If exit code 3 (`PurelymailAuthError`), a stale token is still in use —
   re-check step 2 for every location.

## Verification

- `purelymail account credit --profile <name>` succeeds.
- No `PurelymailAuthError` in logs for that profile.

## Rollback / abort

- Because PurelyMail keeps one active key, there is no dual-valid window: if a
  consumer breaks, re-refresh and re-distribute. Keep the change small and
  coordinated.

## Escalation

- Confirmed exposure → treat as an incident (`workflow-incident-response`): rotate
  first, then review what the exposed token could access, and audit account
  activity in PurelyMail.

## Related

- `docs/runbooks/dependency-patch.md`; `SECURITY.md`.
