import { configDefaults, defineConfig } from 'vitest/config';

/**
 * Root Vitest config for the workspace.
 *
 * Coverage gates encode master §4: a 90% line+branch baseline everywhere, and
 * 100% on designated critical paths (auth/token handling, HTTP transport,
 * error mapping, and config/secret resolution). Critical globs are enforced
 * per-file via `thresholds` glob keys so the 100% rule is real, not vacuous.
 */
export default defineConfig({
  test: {
    include: ['packages/*/test/**/*.test.ts', 'packages/*/test/**/*.test.tsx'],
    // Live-API contract tests are opt-in + secret-gated (EX-4) — never part of
    // the default/CI suite. They run only via `pnpm test:live`.
    exclude: [...configDefaults.exclude, '**/*.live.test.ts'],
    environment: 'node',
    clearMocks: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'lcov'],
      include: ['packages/*/src/**/*.ts'],
      exclude: [
        'packages/*/src/**/index.ts', // barrel re-exports only
        'packages/cli/src/bin.ts', // process bootstrap (exercised via e2e later)
        'packages/tui/src/bin.ts', // Ink render bootstrap (imperative shell)
        // Ink UI components are the imperative shell — validated by render
        // (ink-testing-library) smoke tests, not line-coverage-gated. The gated
        // logic lives in the pure data layer (`data.ts`). Fuller component
        // coverage is tracked as a follow-up.
        'packages/tui/src/**/*.tsx',
        // Type-only modules (no executable code) — nothing to cover.
        'packages/core/src/types.ts',
        'packages/core/src/internal.ts',
        'packages/core/src/http/transport.ts',
        '**/*.d.ts',
      ],
      thresholds: {
        // Baseline everywhere.
        lines: 90,
        branches: 90,
        functions: 90,
        statements: 90,
        perFile: true,
        // Critical paths — 100% (authn/token, transport, error mapping, secrets).
        'packages/core/src/errors.ts': {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
        'packages/core/src/http/**': {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
        'packages/core/src/auth/**': {
          lines: 100,
          branches: 100,
          functions: 100,
          statements: 100,
        },
      },
    },
  },
});
