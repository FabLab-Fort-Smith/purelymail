import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts', 'src/bin.ts'],
  format: ['esm'],
  dts: { entry: 'src/index.ts' },
  sourcemap: true,
  clean: true,
  target: 'node20',
  // Keep the workspace core + optional native keyring external (not bundled).
  external: ['@fablabfortsmith/purelymail-core', '@napi-rs/keyring'],
});
