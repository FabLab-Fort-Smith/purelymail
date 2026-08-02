#!/usr/bin/env node
/**
 * Executable entry point for the `purelymail` command.
 *
 * @packageDocumentation
 */

import { run } from './program.js';

run(process.argv.slice(2))
  .then((code) => {
    process.exitCode = code;
  })
  .catch((error: unknown) => {
    // Should not happen (run() never throws), but fail closed just in case.
    process.stderr.write(`fatal: ${String(error)}\n`);
    process.exitCode = 1;
  });
