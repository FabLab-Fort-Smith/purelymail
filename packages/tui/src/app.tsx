import React from 'react';
import { Box, Text, useApp, useInput } from 'ink';

/**
 * Root component of the PurelyMail TUI.
 *
 * Phase 1 scaffold: renders a title bar and a placeholder pane, and quits on
 * `q`/Ctrl-C. The read-first multi-org dashboard (profiles → domains/users/
 * routing across accounts, built on {@link PurelymailWorkspace}) lands next.
 *
 * @returns The rendered application tree.
 */
export function App(): React.ReactElement {
  const { exit } = useApp();
  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        PurelyMail TUI
      </Text>
      <Text dimColor>
        Multi-org dashboard — coming soon. Press <Text color="yellow">q</Text> to quit.
      </Text>
    </Box>
  );
}
