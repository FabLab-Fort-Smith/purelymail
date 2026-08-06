#!/usr/bin/env node
import { createElement } from 'react';
import { render } from 'ink';
import { PurelymailWorkspace } from '@fablabfortsmith/purelymail-core';
import { loadProfiles } from '@fablabfortsmith/purelymail-config';
import { App } from './app.js';

// Imperative shell: load the same profile config the CLI uses (tokens stay in
// their env var / keychain — never in config), build a workspace over every
// account, and mount the Ink app. Fail closed on a bad config.
try {
  const { registry, notify } = loadProfiles();
  const profiles = registry.list();
  const workspace = new PurelymailWorkspace();
  render(createElement(App, { workspace, profiles, ...(notify ? { notify } : {}) }));
} catch (cause) {
  process.stderr.write(
    `purelymail-tui: ${cause instanceof Error ? cause.message : String(cause)}\n`,
  );
  process.exitCode = 1;
}
