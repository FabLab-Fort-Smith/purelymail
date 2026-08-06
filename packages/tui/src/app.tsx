import type { ReactElement } from 'react';
import { Box, Text } from 'ink';
import type { Profile, PurelymailWorkspace } from '@fablabfortsmith/purelymail-core';
import type { ResolvedNotify } from '@fablabfortsmith/purelymail-config';
import { Dashboard } from './components/Dashboard.js';

/** Props for the {@link App} root. */
export interface AppProps {
  readonly workspace: PurelymailWorkspace;
  readonly profiles: readonly Profile[];
  /** Resolved `[notify]` SMTP settings, if configured. */
  readonly notify?: ResolvedNotify;
}

/**
 * Root component: renders the multi-org {@link Dashboard}, or a hint when no
 * accounts are configured. I/O (config loading, workspace construction) happens
 * in the imperative shell (`bin.ts`) and is injected here.
 *
 * @param props - Workspace + configured accounts.
 * @returns The application tree.
 */
export function App({ workspace, profiles, notify }: AppProps): ReactElement {
  if (profiles.length === 0) {
    return (
      <Box padding={1}>
        <Text color="yellow">
          No accounts configured. Add one with the CLI (`purelymail init`), then relaunch.
        </Text>
      </Box>
    );
  }
  return (
    <Dashboard
      workspace={workspace}
      profiles={profiles}
      {...(notify !== undefined ? { notify } : {})}
    />
  );
}
