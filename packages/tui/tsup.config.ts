import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/bin.ts'],
  format: ['esm'],
  dts: { entry: 'src/index.ts' },
  sourcemap: true,
  clean: true,
  target: 'node20',
  // Keep the workspace core + the React/Ink runtime external (not bundled).
  external: ['@fablabfortsmith/purelymail-core', 'react', 'ink'],
  // Use the automatic JSX runtime (matches tsconfig `jsx: react-jsx`).
  esbuildOptions(options) {
    options.jsx = 'automatic';
  },
});
