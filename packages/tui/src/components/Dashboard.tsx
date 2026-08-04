import { useEffect, useState, type ReactElement } from 'react';
import { Box, Text, useApp, useInput } from 'ink';
import type { Profile, PurelymailWorkspace } from '@fablabfortsmith/purelymail-core';
import { fetchTab, TABS, type Tab, type TableModel } from '../data.js';
import { createUser, deleteUser, modifyUser, type NewUserForm } from '../mutations.js';
import { Table } from './Table.js';
import { CreateUserForm } from './forms/CreateUserForm.js';
import { EditUserForm, type EditUserFormValues } from './forms/EditUserForm.js';
import { ConfirmPrompt } from './forms/ConfirmPrompt.js';

/** Props for the {@link Dashboard}. */
export interface DashboardProps {
  readonly workspace: PurelymailWorkspace;
  readonly profiles: readonly Profile[];
}

/** Tabs where a row can be selected for row-scoped actions. */
const SELECTABLE: ReadonlySet<Tab> = new Set<Tab>(['users', 'routing']);

type Mode = 'browse' | 'create-user' | 'edit-user' | 'confirm-delete-user';

/** The user a row-scoped action targets. */
interface UserTarget {
  readonly userName: string;
  readonly profileName: string;
}

/**
 * Multi-org dashboard with interactive management. A tabbed, aggregated view
 * (domains, users, routing, credit) across accounts; on the users/routing tabs
 * ↑/↓ selects a row and `n` starts a create flow. Keys: `tab`/←→ switch view,
 * `r` refresh, `n` new (users), `q`/Ctrl-C quit.
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
  const [selected, setSelected] = useState(0);
  const [mode, setMode] = useState<Mode>('browse');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [target, setTarget] = useState<UserTarget | null>(null);

  const rows = model?.rows.length ?? 0;
  const clamped = rows === 0 ? 0 : Math.min(selected, rows - 1);

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

  const refresh = (): void => setNonce((n) => n + 1);
  const switchTab = (delta: number): void => {
    setSelected(0);
    setTab((t) => TABS[(TABS.indexOf(t) + delta + TABS.length) % TABS.length] ?? t);
  };

  const clientFor = (profileName: string): ReturnType<PurelymailWorkspace['client']> | null => {
    const profile = profiles.find((p) => p.name === profileName);
    return profile ? workspace.client(profile) : null;
  };
  const fail = (cause: unknown): void =>
    setFeedback(`Error: ${cause instanceof Error ? cause.message : String(cause)}`);

  const handleCreateUser = (form: NewUserForm): void => {
    setMode('browse');
    const account = profiles[0];
    if (!account) {
      setFeedback('No account to create in.');
      return;
    }
    setFeedback(`Creating ${form.localPart}@${form.domain}…`);
    createUser(workspace.client(account), form)
      .then(() => {
        setFeedback(`Created ${form.localPart}@${form.domain}`);
        refresh();
      })
      .catch(fail);
  };

  const handleEditUser = (values: EditUserFormValues): void => {
    setMode('browse');
    const client = target ? clientFor(target.profileName) : null;
    if (!target || !client) {
      setFeedback('No account for the selected user.');
      return;
    }
    setFeedback(`Updating ${target.userName}…`);
    modifyUser(client, {
      userName: target.userName,
      newLocalPart: values.newLocalPart,
      newPassword: values.newPassword,
    })
      .then(() => {
        setFeedback(`Updated ${target.userName}`);
        refresh();
      })
      .catch(fail);
  };

  const handleDeleteUser = (): void => {
    setMode('browse');
    const client = target ? clientFor(target.profileName) : null;
    if (!target || !client) {
      setFeedback('No account for the selected user.');
      return;
    }
    const name = target.userName;
    setFeedback(`Deleting ${name}…`);
    deleteUser(client, name)
      .then(() => {
        setFeedback(`Deleted ${name}`);
        refresh();
      })
      .catch(fail);
  };

  const targetSelectedUser = (): UserTarget | null => {
    const row = model?.rows[clamped];
    const userName = row?.['username'] ?? '';
    const profileName = row?.['profile'] ?? '';
    return userName !== '' && profileName !== '' ? { userName, profileName } : null;
  };

  useInput((input, key) => {
    if (mode !== 'browse') {
      return; // the active form owns input
    }
    if (input === 'q' || (key.ctrl && input === 'c')) {
      exit();
    } else if (input === 'r') {
      refresh();
    } else if (key.tab || key.rightArrow) {
      switchTab(1);
    } else if (key.leftArrow) {
      switchTab(-1);
    } else if (key.upArrow) {
      setSelected((s) => Math.max(0, s - 1));
    } else if (key.downArrow) {
      setSelected((s) => (rows === 0 ? 0 : Math.min(rows - 1, s + 1)));
    } else if (input === 'n' && tab === 'users') {
      setFeedback(null);
      setMode('create-user');
    } else if (input === 'e' && tab === 'users') {
      const t = targetSelectedUser();
      if (t) {
        setTarget(t);
        setFeedback(null);
        setMode('edit-user');
      }
    } else if (input === 'd' && tab === 'users') {
      const t = targetSelectedUser();
      if (t) {
        setTarget(t);
        setFeedback(null);
        setMode('confirm-delete-user');
      }
    }
  });

  const selectedUsername = tab === 'users' ? (model?.rows[clamped]?.['username'] ?? '') : '';
  const domainHint = selectedUsername.includes('@')
    ? selectedUsername.slice(selectedUsername.indexOf('@') + 1)
    : undefined;

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
        {mode === 'create-user' ? (
          <CreateUserForm
            onSubmit={handleCreateUser}
            onCancel={() => setMode('browse')}
            {...(domainHint !== undefined ? { domainHint } : {})}
          />
        ) : mode === 'edit-user' && target ? (
          <EditUserForm
            userName={target.userName}
            onSubmit={handleEditUser}
            onCancel={() => setMode('browse')}
          />
        ) : mode === 'confirm-delete-user' && target ? (
          <ConfirmPrompt
            message={`Delete ${target.userName}? This cannot be undone.`}
            onConfirm={handleDeleteUser}
            onCancel={() => setMode('browse')}
          />
        ) : loading ? (
          <Text dimColor>Loading {tab}…</Text>
        ) : error ? (
          <Text color="red">Error: {error}</Text>
        ) : model ? (
          <Box flexDirection="column">
            <Table model={model} {...(SELECTABLE.has(tab) ? { selectedIndex: clamped } : {})} />
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

      {feedback ? (
        <Box marginTop={1}>
          <Text color={feedback.startsWith('Error') ? 'red' : 'green'}>{feedback}</Text>
        </Box>
      ) : null}

      <Box marginTop={1}>
        <Text dimColor>
          [tab/←→] view {SELECTABLE.has(tab) ? '[↑↓] select ' : ''}
          {tab === 'users' ? '[n]ew [e]dit [d]el ' : ''}[r] refresh [q] quit
        </Text>
      </Box>
    </Box>
  );
}
