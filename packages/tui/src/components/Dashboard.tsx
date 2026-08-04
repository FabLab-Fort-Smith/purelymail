import { useEffect, useState, type ReactElement } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type { Profile, PurelymailWorkspace } from '@fablabfortsmith/purelymail-core';
import { fetchTab, TABS, type Tab, type TableModel } from '../data.js';
import { Table } from './Table.js';

/** Props for the {@link Dashboard}. */
export interface DashboardProps {
  readonly workspace: PurelymailWorkspace;
  readonly profiles: readonly Profile[];
}

/**
 * Read-first multi-org dashboard: a tabbed, aggregated view (domains, users,
 * routing, credit) across all selected accounts. Keys: `tab`/arrows switch
 * view, `r` refreshes, `q`/Ctrl-C quits.
 *
 * @param props - Workspace + the accounts to show.
 * @returns The dashboard tree.
 */
export function Dashboard({ workspace, profiles }: DashboardProps): ReactElement {
  const { exit } = useApp();
  const [tab, setTab] = useState<Tab>('domains');
  const [model, setModel] = useState<TableModel | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [nonce, setNonce] = useState(0);

  useEffect(() => {
    let active = true;
    setLoading(true);
    setError(null);
    fetchTab(workspace, profiles, tab)
      .then((next) => {
        if (active) {
          setModel(next);
          setLoading(false);
        }
      })
      .catch((cause: unknown) => {
        if (active) {
          setError(cause instanceof Error ? cause.message : String(cause));
          setLoading(false);
        }
      });
    return () => {
      active = false;
    };
  }, [workspace, profiles, tab, nonce]);

  useInput((input, key) => {
    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
    } else if (input === 'r') {
      setNonce((n) => n + 1);
    } else if (key.tab || key.rightArrow) {
      setTab((t) => TABS[(TABS.indexOf(t) + 1) % TABS.length] ?? t);
    } else if (key.leftArrow) {
      setTab((t) => TABS[(TABS.indexOf(t) + TABS.length - 1) % TABS.length] ?? t);
    }
  });

  return (
    <Box flexDirection="column" padding={1}>
      <Text bold color="cyan">
        PurelyMail — {profiles.length} account(s)
      </Text>
      <Box>
        {TABS.map((t) => (
          <Text key={t} bold={t === tab} {...(t === tab ? { color: 'yellow' as const } : {})}>
            {` ${t} `}
          </Text>
        ))}
      </Box>
      <Box marginTop={1} flexDirection="column">
        {loading ? (
          <Text dimColor>Loading {tab}…</Text>
        ) : error ? (
          <Text color="red">Error: {error}</Text>
        ) : model ? (
          <Box flexDirection="column">
            <Table model={model} />
            {model.failures.length > 0 ? (
              <Box flexDirection="column" marginTop={1}>
                {model.failures.map((f, i) => (
                  <Text key={i} color="red">
                    ! {f.profile}
                    {f.org ? ` (${f.org})` : ''}: {f.error}
                  </Text>
                ))}
              </Box>
            ) : null}
          </Box>
        ) : null}
      </Box>
      <Box marginTop={1}>
        <Text dimColor>[tab/←→] switch view [r] refresh [q] quit</Text>
      </Box>
    </Box>
  );
}
