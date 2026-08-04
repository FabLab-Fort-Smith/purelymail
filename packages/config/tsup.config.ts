import { defineConfig } from 'tsup';

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  dts: { entry: 'src/index.ts' },
  sourcemap: true,
  clean: true,
  target: 'node20',
  // Core + the optional native keyring stay external (not bundled).
  external: ['@fablabfortsmith/purelymail-core', '@napi-rs/keyring'],
});
