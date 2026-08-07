// Flat ESLint config (ESLint 9 + typescript-eslint).
// Enforces type-aware correctness rules and the SSDLC docs mandate
// (JSDoc/TSDoc on every exported symbol) mechanically — see topic-documentation.
import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import jsdoc from 'eslint-plugin-jsdoc';

export default tseslint.config(
  {
    ignores: [
      '**/dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      'docs/api/**',
      '**/*.config.js',
      '**/*.config.ts',
      '**/*.config.mjs', // stryker.config.mjs (config, not shipped code)
      'scripts/**/*.mjs', // ops/dev helper scripts (not shipped); Prettier-checked
      '.stryker-tmp/**', // Stryker sandbox (mutated copies carry @ts-nocheck)
      'reports/**', // generated mutation/HTML reports
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      // Fail closed on ignored async errors / unhandled promises (error-handling).
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/no-misused-promises': 'error',
      // Discourage `any`; force explicit unknown + narrowing at boundaries.
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-console': 'off',
    },
  },
  // Docs mandate: every EXPORTED symbol in library/CLI source carries a doc comment.
  {
    files: ['packages/*/src/**/*.ts'],
    plugins: { jsdoc },
    rules: {
      'jsdoc/require-jsdoc': [
        'error',
        {
          publicOnly: true,
          require: {
            FunctionDeclaration: true,
            ClassDeclaration: true,
            MethodDefinition: true,
          },
          contexts: [
            'ExportNamedDeclaration > TSInterfaceDeclaration',
            'ExportNamedDeclaration > TSTypeAliasDeclaration',
            'ExportNamedDeclaration > TSEnumDeclaration',
          ],
          checkConstructors: false,
        },
      ],
      // Every documented symbol needs prose, except constructors (covered by
      // the class description + their @param tags).
      'jsdoc/require-description': ['error', { checkConstructors: false }],
    },
  },
  // Tests are exempt from the docs mandate and may use loosened typing.
  {
    files: ['packages/*/test/**/*.ts', 'packages/*/test/**/*.tsx', '**/*.test.ts', '**/*.test.tsx'],
    rules: {
      'jsdoc/require-jsdoc': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-unsafe-assignment': 'off',
      '@typescript-eslint/no-unsafe-member-access': 'off',
      '@typescript-eslint/no-unsafe-argument': 'off',
      '@typescript-eslint/no-unsafe-return': 'off',
      '@typescript-eslint/no-unsafe-call': 'off',
      '@typescript-eslint/require-await': 'off',
    },
  },
);
