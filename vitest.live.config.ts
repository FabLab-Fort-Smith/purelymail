import { defineConfig } from 'vitest/config';

/**
 * Vitest config for the opt-in live-API contract tests (COMPLIANCE EX-4).
 *
 * Runs ONLY `*.live.test.ts` (excluded from the default suite in
 * `vitest.config.ts`). Invoked via `pnpm test:live` and, in CI, only by the
 * manually-dispatched, secret-gated `.github/workflows/live-contract.yml`.
 * No coverage gates — these hit the real network and are non-deterministic by
 * nature; they assert contract shape, not coverage.
 */
export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.live.test.ts'],
    // Without PURELYMAIL_LIVE_TOKEN every case is skipped → zero executed tests.
    // That's the intended "fail closed" no-op, not a failure.
    passWithNoTests: true,
    environment: 'node',
    // Real network calls — give them room; keep them serial to be gentle on the
    // live account and any rate limits.
    testTimeout: 30000,
    fileParallelism: false,
  },
});
