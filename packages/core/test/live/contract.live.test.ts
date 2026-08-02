/**
 * Live-API contract test (opt-in, secret-gated) — COMPLIANCE EX-4.
 *
 * Exercises the REAL PurelyMail API to confirm the responses still match the
 * client's zod schemas (a drift / contract check). It is EXCLUDED from the
 * default suite (`vitest.config.ts` ignores `*.live.test.ts`) and only runs via
 * `pnpm test:live` (`vitest.live.config.ts`), which is invoked exclusively by
 * the manually-dispatched `.github/workflows/live-contract.yml`.
 *
 * Safety:
 * - **Read-only only** — `domains.list()` and `account.credit()`. It never
 *   creates, modifies, or deletes anything on the account.
 * - **Fails closed** — skips entirely unless `PURELYMAIL_LIVE_TOKEN` is set, so
 *   it can never run (or leak a token) by accident in normal CI.
 *
 * A schema mismatch surfaces as a thrown `PurelymailValidationError` from the
 * client, failing the test — which is the signal that the API contract drifted
 * (feeds EX-5: confirm/adjust the response modeling).
 */
import { describe, expect, it } from 'vitest';
import { PurelymailClient } from '../../src/client.js';

// Treat an empty string as absent (an unset CI secret expands to '').
const token = process.env['PURELYMAIL_LIVE_TOKEN'] || undefined;

/** Build a client bound to the live token (constructed only past the skip gate,
 * since a missing/empty token makes the constructor fail closed). */
function liveClient(): PurelymailClient {
  // Only set the `token` key when defined (exactOptionalPropertyTypes); when
  // absent the constructor would fail closed, but the skip gate prevents that.
  return new PurelymailClient(token ? { token } : {});
}

// Explicit opt-in: without the token each case is skipped (fail closed). Skip at
// the `it` level (not `describe`) so the cases are still collected — a file with
// zero collected tests is a vitest error.
describe('PurelyMail live API contract (read-only)', () => {
  it.skipIf(!token)('domains.list() returns a schema-valid result', async () => {
    // If the live response drifts from `listDomainsResultSchema`, the client
    // throws PurelymailValidationError and this test fails.
    const result = await liveClient().domains.list();
    expect(result).toBeTypeOf('object');
    expect(Array.isArray(result.domains)).toBe(true);
  });

  it.skipIf(!token)('account.credit() returns a schema-valid result', async () => {
    const credit = await liveClient().account.credit();
    expect(credit).toBeTypeOf('object');
  });
});
